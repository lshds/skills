import { greet } from '@example/greet';

import { formatName } from '~/format';

export const message = greet(formatName('ada'));
