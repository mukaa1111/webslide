export function renderInline(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="font-family:monospace;background:rgba(0,0,0,0.07);padding:1px 5px;border-radius:3px;font-size:0.9em">$1</code>');
}
