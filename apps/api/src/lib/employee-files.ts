export function fileExtensionFromName(name: string): string {
  const match = /\.[a-zA-Z0-9]{1,8}$/.exec(name);
  return match ? match[0] : "";
}
