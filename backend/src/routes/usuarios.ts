import { Hono } from 'hono';
import bcrypt from 'bcryptjs';
import { db } from '../db';
import { usuarios } from '../db/schema';
import { eq, asc } from 'drizzle-orm';

const usuariosRouter = new Hono();

// 1. GET / — Listar todos os usuários (sem expor o hash da senha)
usuariosRouter.get('/', async (c) => {
  try {
    const lista = await db
      .select({
        id: usuarios.id,
        username: usuarios.username,
        name: usuarios.name,
        role: usuarios.role,
        status: usuarios.status,
        createdAt: usuarios.createdAt,
      })
      .from(usuarios)
      .orderBy(asc(usuarios.name));

    return c.json(lista);
  } catch (err) {
    console.error('[usuarios] Erro ao listar usuários:', err);
    return c.json({ erro: 'Falha ao buscar usuários no banco de dados' }, 500);
  }
});

// 2. POST / — Criar um novo usuário técnico/profissional
usuariosRouter.post('/', async (c) => {
  try {
    const body = await c.req.json();
    const { username, name, password, role } = body;

    if (!username || !name || !password || !role) {
      return c.json({ erro: 'Campos obrigatórios ausentes' }, 400);
    }

    const cleanUsername = username.trim().toLowerCase();

    // Validar se o usuário já existe
    const [existente] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.username, cleanUsername));

    if (existente) {
      return c.json({ erro: 'Este nome de usuário já está sendo utilizado' }, 400);
    }

    // Gerar hash de senha
    const hash = await bcrypt.hash(password, 12);

    const [novo] = await db
      .insert(usuarios)
      .values({
        username: cleanUsername,
        name: name.trim(),
        passwordHash: hash,
        role: role.trim(),
        status: 'ativo',
        createdAt: new Date().toISOString(),
      })
      .returning();

    // Retorna sem o hash da senha
    return c.json({
      id: novo.id,
      username: novo.username,
      name: novo.name,
      role: novo.role,
      status: novo.status,
      createdAt: novo.createdAt,
    }, 201);

  } catch (err) {
    console.error('[usuarios] Erro ao criar usuário:', err);
    return c.json({ erro: 'Falha ao criar o usuário no banco de dados' }, 500);
  }
});

// 3. PUT /:id — Atualizar dados do usuário
usuariosRouter.put('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) {
      return c.json({ erro: 'ID inválido' }, 400);
    }

    const body = await c.req.json();
    const { name, password, role, status } = body;

    // Verificar se o usuário existe
    const [existente] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, id));

    if (!existente) {
      return c.json({ erro: 'Usuário não encontrado' }, 404);
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (role !== undefined) updateData.role = role.trim();
    if (status !== undefined) updateData.status = status;

    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 12);
    }

    const [atualizado] = await db
      .update(usuarios)
      .set(updateData)
      .where(eq(usuarios.id, id))
      .returning();

    return c.json({
      id: atualizado.id,
      username: atualizado.username,
      name: atualizado.name,
      role: atualizado.role,
      status: atualizado.status,
      createdAt: updatedTime(atualizado.createdAt),
    });

  } catch (err) {
    console.error('[usuarios] Erro ao atualizar usuário:', err);
    return c.json({ erro: 'Falha ao atualizar o usuário no banco de dados' }, 500);
  }
});

function updatedTime(val: string | null | undefined) {
  return val || new Date().toISOString();
}

// 4. DELETE /:id — Remover usuário (com trava contra auto-exclusão)
usuariosRouter.delete('/:id', async (c) => {
  try {
    const id = Number(c.req.param('id'));
    if (isNaN(id)) {
      return c.json({ erro: 'ID inválido' }, 400);
    }

    // Verificar payload do JWT do usuário solicitante
    const payload = c.get('jwtPayload') as { sub?: string } | undefined;
    const currentUsername = payload?.sub;

    const [existente] = await db
      .select()
      .from(usuarios)
      .where(eq(usuarios.id, id));

    if (!existente) {
      return c.json({ erro: 'Usuário não encontrado' }, 404);
    }

    // Impedir auto-exclusão
    if (currentUsername && existente.username.toLowerCase() === currentUsername.toLowerCase()) {
      return c.json({ erro: 'Não é possível excluir o próprio usuário logado' }, 400);
    }

    await db.delete(usuarios).where(eq(usuarios.id, id));

    return c.json({ sucesso: true, mensagem: `Usuário '${existente.username}' removido com sucesso` });

  } catch (err) {
    console.error('[usuarios] Erro ao excluir usuário:', err);
    return c.json({ erro: 'Falha ao excluir o usuário no banco de dados' }, 500);
  }
});

export default usuariosRouter;
