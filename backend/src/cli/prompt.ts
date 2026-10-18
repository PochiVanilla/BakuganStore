import { Writable } from 'node:stream';
import { createInterface, type Interface } from 'node:readline/promises';

/**
 * Hỏi từng câu trong terminal. Khi gõ mật khẩu thì không hiện chữ ra màn hình.
 * Nếu dữ liệu được đưa vào qua ống (không phải terminal), đọc lần lượt từng dòng.
 */
export class Prompter {
  private muted = false;
  private readonly rl: Interface;
  private readonly lines: string[] = [];
  private readonly waiting: Array<(line: string | undefined) => void> = [];
  private closed = false;
  private readonly interactive = Boolean(process.stdin.isTTY);

  constructor() {
    const output = new Writable({
      write: (chunk: Buffer, _encoding, done) => {
        if (!this.muted) process.stdout.write(chunk);
        done();
      },
    });
    this.rl = createInterface({ input: process.stdin, output, terminal: this.interactive });
    if (!this.interactive) {
      this.rl.on('line', (line) => {
        const next = this.waiting.shift();
        if (next) next(line);
        else this.lines.push(line);
      });
      this.rl.on('close', () => {
        this.closed = true;
        this.waiting.splice(0).forEach((resolve) => resolve(undefined));
      });
    }
  }

  async ask(question: string, options: { hidden?: boolean } = {}): Promise<string> {
    if (!this.interactive) {
      process.stdout.write(question + (options.hidden ? '\n' : ''));
      const line =
        this.lines.shift() ??
        (this.closed
          ? undefined
          : await new Promise<string | undefined>((r) => this.waiting.push(r)));
      if (line === undefined) throw new Error('Thiếu dữ liệu nhập vào.');
      if (!options.hidden) process.stdout.write(`${line}\n`);
      return line.trim();
    }
    process.stdout.write(question);
    this.muted = Boolean(options.hidden);
    try {
      const answer = await this.rl.question('');
      return answer.trim();
    } finally {
      if (this.muted) process.stdout.write('\n');
      this.muted = false;
    }
  }

  close(): void {
    this.rl.close();
  }
}
