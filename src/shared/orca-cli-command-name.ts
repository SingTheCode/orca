export function getOrcaCliCommandNameForPlatform(platform: NodeJS.Platform): string {
  if (platform === 'linux') {
    return 'omdx-ide'
  }
  if (platform === 'win32') {
    return 'omdx.cmd'
  }
  return 'omdx'
}
