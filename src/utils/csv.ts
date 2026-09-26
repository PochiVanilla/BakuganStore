/**
 * Xuất bảng ra file CSV mở được bằng Excel (có BOM để giữ tiếng Việt có dấu).
 * Ô bắt đầu bằng = + - @ bị thêm dấu nháy để Excel không hiểu nhầm là công thức.
 */
export function downloadCsv(
  filename: string,
  header: readonly string[],
  rows: ReadonlyArray<ReadonlyArray<string | number>>,
): void {
  const escape = (value: string | number): string => {
    let text = String(value);
    if (typeof value === 'string' && /^[=+\-@]/.test(text)) text = `'${text}`;
    return /[",\n;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [header, ...rows].map((row) => row.map(escape).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
}
