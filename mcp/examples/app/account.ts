import { getUserById } from '../services/users';

export async function loadAccountSettings(userId: string) {
  const user = await getUserById(userId);

  return {
    email: user.email,
  };
}
