export function downloadBlob(fileName: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  // A large file may still be reading from this URL when click() returns.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function downloadText(fileName: string, text: string, type: string): void {
  downloadBlob(fileName, new Blob([text], { type }));
}
