export interface User {
  id: string;
  displayName: string;
  email: string;
}

export async function getUserById(id: string): Promise<User> {
  return {
    id,
    displayName: 'Ada Lovelace',
    email: 'ada@example.com',
  };
}
