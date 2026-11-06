/** Erro vindo da API, já com a mensagem em português para mostrar na tela. */
export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

/**
 * Chama a API pelo próprio site (/api/...). O cookie de login vai junto
 * automaticamente; o JavaScript nunca toca nele.
 */
export async function api<T = unknown>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: init.method ?? 'GET',
    headers: init.body !== undefined ? { 'content-type': 'application/json' } : undefined,
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: 'same-origin',
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    const message = typeof data?.message === 'string' ? data.message : 'Algo deu errado. Tente de novo em instantes.';
    throw new ApiError(message, res.status);
  }
  return data as T;
}

export type Me = {
  id: string;
  name: string;
  email: string;
  handle: string;
  bio: string;
  role: 'member' | 'admin';
  photoUrl: string | null;
  googleConnected: boolean;
  googleCalendar: { available: boolean; connected: boolean };
  preferences: {
    palette: 'natureza' | 'serenity' | 'soft' | 'dourado' | 'mindful' | 'premium';
    randomTheme: boolean;
    themeMode: 'auto' | 'light' | 'dark';
    defaultPostVisibility: 'publico' | 'amigos' | 'privado';
  };
  xp: { total: number; gems: number };
  /** Passa pela Jornada de primeiro acesso (a aba Jornada fica no lugar do Feed). */
  journey: boolean;
  /** Rede social (Feed, stories, amigos, grupos): aberta ou, na Jornada, quando abre. */
  social: { open: boolean; freeAt: string | null; journeyDoneAt: string | null };
  /** Já viu o troféu "Jornada concluída". */
  journeyCelebrated: boolean;
  /** Já apertou "Concluir minha jornada" (o XP passa a aparecer e a valer). */
  journeyFinished: boolean;
};

/** Sai da conta e volta para a tela de login. */
export async function logout() {
  await api('/auth/logout', { method: 'POST' }).catch(() => undefined);
  window.location.href = '/login';
}
