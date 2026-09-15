import { getUserById } from '../services/users';

export async function loadProfilePage(userId: string) {
  const user = await getUserById(userId);

  return {
    title: user.displayName,
    email: user.email,
  };
}
