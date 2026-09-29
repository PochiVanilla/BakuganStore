/*
 * Kiểm tra luật dùng chung code với web (chạy: npm run check:shared, và trong bộ test).
 *
 * 1. Code backend chỉ được import code của web (../src, ../api) qua backend/src/shared/.
 * 2. Mọi file web mà backend kéo theo (kể cả gián tiếp) phải "thuần": file .ts, không React,
 *    không thư viện giao diện, không dữ liệu giả (src/mocks), không tầng gọi API / store.
 *    Ngoại lệ duy nhất: src/mocks/blog.ts (nội dung 6 bài blog làm dữ liệu ban đầu).
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const repoDir = path.resolve(backendDir, '..');
const webSrcDir = path.join(repoDir, 'src');
const webApiDir = path.join(repoDir, 'api');
const gatewayDir = path.join(backendDir, 'src', 'shared');

/** Thư viện mà file web dùng chung được phép import (chạy được ở server). */
const ALLOWED_PACKAGES = new Set(['zod']);
/** File web dùng chung không được nằm trong các thư mục này. */
const FORBIDDEN_WEB_DIRS = [
  'mocks',
  'services',
  'store',
  'components',
  'pages',
  'hooks',
  'layouts',
];
const ALLOWED_EXCEPTIONS = new Set([path.join(webSrcDir, 'mocks', 'blog.ts')]);

const IMPORT_PATTERN =
  /(?:^|[\s;])(?:import|export)\s+(?:type\s+)?(?:[\w*{}\s,$]+?\s+from\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function listTsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return listTsFiles(full);
    return /\.tsx?$/.test(name) ? [full] : [];
  });
}

function importsOf(file: string): string[] {
  const code = readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
  return [...code.matchAll(IMPORT_PATTERN)].map((match) => (match[1] ?? match[2])!);
}

function resolveFile(base: string): string | undefined {
  const candidates = [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')];
  return candidates.find((candidate) => existsSync(candidate) && statSync(candidate).isFile());
}

/** Đường dẫn file mà một import trỏ tới; `undefined` với thư viện trong node_modules. */
function resolveImport(fromFile: string, specifier: string): string | undefined {
  if (specifier.startsWith('@/')) return resolveFile(path.join(webSrcDir, specifier.slice(2)));
  if (specifier.startsWith('.'))
    return resolveFile(path.resolve(path.dirname(fromFile), specifier));
  return undefined;
}

const isInside = (file: string, dir: string): boolean =>
  file === dir || file.startsWith(`${dir}${path.sep}`);
const relative = (file: string): string => path.relative(repoDir, file);

export function checkSharedImports(): string[] {
  const problems: string[] = [];
  const sharedEntries: string[] = [];

  // Luật 1: backend chỉ chạm code web qua src/shared.
  for (const file of listTsFiles(path.join(backendDir, 'src'))) {
    const inGateway = isInside(file, gatewayDir);
    for (const specifier of importsOf(file)) {
      const target = resolveImport(file, specifier);
      // Import tương đối trỏ ra ngoài backend/ cũng tính là chạm code web, kể cả khi gõ sai đường dẫn.
      const leavesBackend =
        specifier.startsWith('.') &&
        !isInside(path.resolve(path.dirname(file), specifier), backendDir);
      const reachesWeb =
        specifier.startsWith('@/') ||
        leavesBackend ||
        (target !== undefined && (isInside(target, webSrcDir) || isInside(target, webApiDir)));
      if (!reachesWeb) continue;
      if (!inGateway) {
        problems.push(`${relative(file)}: import "${specifier}" phải đi qua backend/src/shared/`);
      } else if (target) {
        sharedEntries.push(target);
      } else {
        problems.push(`${relative(file)}: không tìm thấy file cho import "${specifier}"`);
      }
    }
  }

  // Luật 2: mọi file web bị kéo theo phải thuần.
  const seen = new Set<string>();
  const queue = [...sharedEntries];
  while (queue.length > 0) {
    const file = queue.shift()!;
    if (seen.has(file)) continue;
    seen.add(file);
    const where = relative(file);

    if (file.endsWith('.tsx'))
      problems.push(`${where}: file giao diện (.tsx) không dùng chung được`);
    if (!ALLOWED_EXCEPTIONS.has(file)) {
      for (const dir of FORBIDDEN_WEB_DIRS) {
        if (isInside(file, path.join(webSrcDir, dir))) {
          problems.push(`${where}: nằm trong src/${dir}/ — không dùng chung với backend được`);
        }
      }
    }
    for (const specifier of importsOf(file)) {
      const target = resolveImport(file, specifier);
      if (target) {
        queue.push(target);
      } else if (!specifier.startsWith('@/') && !specifier.startsWith('.')) {
        const pkg = specifier.startsWith('@')
          ? specifier.split('/').slice(0, 2).join('/')
          : specifier.split('/')[0]!;
        if (!ALLOWED_PACKAGES.has(pkg) && !specifier.startsWith('node:')) {
          problems.push(`${where}: import thư viện "${specifier}" không dùng ở server được`);
        }
      } else {
        problems.push(`${where}: không tìm thấy file cho import "${specifier}"`);
      }
    }
  }
  return problems;
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  const problems = checkSharedImports();
  if (problems.length > 0) {
    console.error(
      `Vi phạm luật dùng chung code với web:\n${problems.map((p) => `  - ${p}`).join('\n')}`,
    );
    process.exit(1);
  }
  console.warn('Code dùng chung với web: hợp lệ.');
}
