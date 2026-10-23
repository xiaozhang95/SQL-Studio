export const identifier = (name: string, postgres = false) => (postgres ? '"' + name.replaceAll('"', '""') + '"' : '`' + name.replaceAll('`', '``') + '`')
