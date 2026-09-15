import { getUserById } from '../users';

export async function loadUserForTest(id: string) {
  return getUserById(id);
}
