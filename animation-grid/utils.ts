const hasSpace = /\s/;
const hasSeparator = /(_|-|\.|:)/;
const hasCamel = /([a-z][A-Z]|[A-Z][a-z])/;
const separatorSplitter = /[\W_]+(.|$)/g;
const camelSplitter = /(.)([A-Z]+)/g;

export function toNoCase(value: string): string {
  if (!value) return '';
  if (hasSpace.test(value)) return value.toLowerCase();
  if (hasSeparator.test(value)) return (unSeparate(value) || value).toLowerCase();
  if (hasCamel.test(value)) return unCamelize(value).toLowerCase();
  return value.toLowerCase();
}

function unSeparate(value: string): string {
  return value.replace(separatorSplitter, (_, next) => {
    return next ? ' ' + next : '';
  });
}

function unCamelize(value: string): string {
  return value.replace(camelSplitter, (_, previous, uppers) => {
    return `${previous} ${uppers.toLowerCase().split('').join(' ')}`;
  });
}

export function toSpaceCase(value: string): string {
  return toNoCase(value)
    .replace(/[\W_]+(.|$)/g, (_, match) => {
      return match ? ' ' + match : '';
    })
    .trim();
}

export function toKebabCase(value: string): string {
  return toSpaceCase(value).replace(/\s/g, '-');
}
