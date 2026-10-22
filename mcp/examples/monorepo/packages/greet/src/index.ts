import { formatName } from '~/format';

export function greet(name: string): string {
  return `Hello, ${formatName(name)}`;
}
