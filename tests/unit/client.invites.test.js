/* eslint-disable no-undef */
import { clientInvitationCopy } from "../../src/modules/client/invitation-copy.js";
import {
  acceptClientInvite,
  acceptInviteFromWebhook,
  expireStaleTenantInvites,
  invitePendingUsers,
  planMembershipChanges,
} from "../../src/modules/client/invites.js";
import {
  serializeClientDetail,
  serializeClientListItem,
} from "../../src/modules/client/serialize.js";

const later = () => new Date(Date.now() + 86_400_000);
const earlier = () => new Date(Date.now() - 86_400_000);

const usage = { time: new Map(), tokens: new Map() };

function memory({ tenant, users = [], invites = [] }) {
  const state = {
    tenant,
    users: users.map((user) => ({ ...user })),
    invites: invites.map((invite) => ({ ...invite })),
  };
  const revoked = [];
  const prisma = {
    tenant: {
      findUnique: async ({ where }) =>
        where.slug === state.tenant.slug ? state.tenant : null,
    },
    tenantUser: {
      findUnique: async ({ where }) =>
        state.users.find(
          (user) =>
            user.tenantId === where.tenantId_email.tenantId &&
            user.email === where.tenantId_email.email
        ) ?? null,
      create: async ({ data }) => {
        if (
          state.users.some(
            (user) => user.tenantId === data.tenantId && user.email === data.email
          )
        ) {
          const error = new Error("unique");
          error.code = "P2002";
          throw error;
        }
        const row = { id: `user-${state.users.length + 1}`, ...data };
        state.users.push(row);
        return row;
      },
    },
    tenantInvite: {
      findUnique: async ({ where }) =>
        state.invites.find(
          (invite) =>
            invite.tenantId === where.tenantId_email.tenantId &&
            invite.email === where.tenantId_email.email
        ) ?? null,
      findFirst: async ({ where, include }) => {
        const invite = state.invites.find(
          (row) => row.clerkInvitationId === where.clerkInvitationId
        );
        if (!invite) return null;
        return include?.tenant ? { ...invite, tenant: state.tenant } : invite;
      },
      findMany: async () => state.invites.filter((invite) => invite.status === "pending"),
      update: async ({ where, data }) => {
        const invite = state.invites.find((row) => row.id === where.id);
        Object.assign(invite, data);
        return invite;
      },
    },
    $transaction: async (ops) => Promise.all(ops),
  };
  return { prisma, state, revoked };
}

describe("planMembershipChanges", () => {
  const owner = {
    id: "i1",
    email: "owner@example.com",
    role: "owner",
    status: "pending",
    expiresAt: later(),
    clerkInvitationId: "inv_owner",
  };

  test("an open invite is not emailed again", () => {
    const plan = planMembershipChanges({
      members: [],
      invites: [owner],
      desired: [
        { email: "owner@example.com", role: "owner" },
        { email: "new@example.com", role: "viewer" },
      ],
    });
    expect(plan.toInvite.map((user) => user.email)).toEqual(["new@example.com"]);
    expect(plan.removedPending).toEqual([]);
    expect(plan.changedPending).toEqual([]);
  });

  test("a pending role change does not count as a new invite", () => {
    const plan = planMembershipChanges({
      members: [],
      invites: [owner],
      desired: [{ email: "owner@example.com", role: "viewer" }],
    });
    expect(plan.changedPending).toEqual([
      { email: "owner@example.com", role: "viewer" },
    ]);
    expect(plan.toInvite).toEqual([]);
  });

  test("dropping a pending email revokes it", () => {
    const plan = planMembershipChanges({
      members: [],
      invites: [owner],
      desired: [{ email: "other@example.com", role: "owner" }],
    });
    expect(plan.removedPending.map((invite) => invite.email)).toEqual([
      "owner@example.com",
    ]);
    expect(plan.toInvite.map((user) => user.email)).toEqual(["other@example.com"]);
  });

  test("an expired pending email can be invited again", () => {
    const plan = planMembershipChanges({
      members: [],
      invites: [{ ...owner, expiresAt: earlier() }],
      desired: [{ email: "owner@example.com", role: "owner" }],
    });
    expect(plan.toInvite.map((user) => user.email)).toEqual(["owner@example.com"]);
  });
});

describe("acceptClientInvite", () => {
  const tenant = {
    id: "t1",
    slug: "test",
    status: "active",
    provisioningStatus: "ready",
  };
  const invite = {
    id: "i1",
    tenantId: "t1",
    email: "person@example.com",
    role: "project_manager",
    status: "pending",
    expiresAt: later(),
    clerkInvitationId: "inv_1",
  };

  test("creates the membership once", async () => {
    const { prisma, state } = memory({ tenant, invites: [invite] });
    const joined = await acceptClientInvite({
      prisma,
      email: "person@example.com",
      slug: "test",
      revokeInvitation: async () => {},
    });
    expect(joined).toEqual({ slug: "test", role: "project_manager" });
    expect(state.users).toHaveLength(1);
    expect(state.invites[0].status).toBe("accepted");

    const again = await acceptClientInvite({
      prisma,
      email: "person@example.com",
      slug: "test",
      revokeInvitation: async () => {},
    });
    expect(again).toEqual(joined);
    expect(state.users).toHaveLength(1);
  });

  test("an expired invite does not add the person", async () => {
    const { prisma, state } = memory({
      tenant,
      invites: [{ ...invite, expiresAt: earlier() }],
    });
    await expect(
      acceptClientInvite({
        prisma,
        email: "person@example.com",
        slug: "test",
        revokeInvitation: async () => {},
      })
    ).rejects.toMatchObject({ status: 410 });
    expect(state.users).toEqual([]);
    expect(state.invites[0].status).toBe("expired");
  });

  test("a missing invite is a 404", async () => {
    const { prisma } = memory({ tenant });
    await expect(
      acceptClientInvite({
        prisma,
        email: "person@example.com",
        slug: "test",
        revokeInvitation: async () => {},
      })
    ).rejects.toMatchObject({ status: 404, message: "Invitation not found." });
  });

  test("the webhook uses the stored invitation id", async () => {
    const { prisma, state } = memory({ tenant, invites: [invite] });
    await acceptInviteFromWebhook({ prisma, invitationId: "inv_1" });
    expect(state.users[0].email).toBe("person@example.com");
    expect(await acceptInviteFromWebhook({ prisma, invitationId: "missing" })).toBeNull();
  });
});

describe("expireStaleTenantInvites", () => {
  test("marks overdue pending invites expired and revokes the Clerk id", async () => {
    const { prisma, state } = memory({
      tenant: { id: "t1", slug: "test" },
      invites: [
        {
          id: "i1",
          status: "pending",
          expiresAt: earlier(),
          clerkInvitationId: "inv_old",
        },
      ],
    });
    const revoked = [];
    const count = await expireStaleTenantInvites({
      prisma,
      revokeInvitation: async (id) => revoked.push(id),
    });
    expect(count).toBe(1);
    expect(state.invites[0].status).toBe("expired");
    expect(revoked).toEqual(["inv_old"]);
  });
});

describe("invitePendingUsers", () => {
  test("does not email an open invite and marks a known account as existing", async () => {
    const sent = [];
    const invites = [
      {
        id: "i1",
        tenantId: "t1",
        email: "owner@example.com",
        role: "owner",
        status: "pending",
        expiresAt: later(),
        clerkInvitationId: "inv_owner",
      },
    ];
    const prisma = {
      user: {
        findMany: async () => [{ email: "new@example.com" }],
      },
      tenantInvite: {
        findMany: async () => invites.filter((invite) => invite.status === "pending"),
        update: async ({ where, data }) => {
          Object.assign(
            invites.find((invite) => invite.id === where.id),
            data
          );
        },
        upsert: async ({ create }) => {
          invites.push({ id: "i2", ...create });
        },
      },
    };

    const failures = await invitePendingUsers({
      tenantId: "t1",
      slug: "test",
      companyName: "Co",
      users: [
        { email: "owner@example.com", role: "viewer" },
        { email: "new@example.com", role: "owner" },
      ],
      deps: {
        prisma,
        inviteEmail: async (input) => {
          sent.push(input);
          return { invitationId: "inv_new" };
        },
      },
    });

    expect(failures).toEqual([]);
    expect(sent).toEqual([
      {
        email: "new@example.com",
        role: "owner",
        companyName: "Co",
        slug: "test",
        tenantId: "t1",
        existing: true,
      },
    ]);
    expect(invites.find((invite) => invite.email === "owner@example.com").role).toBe(
      "viewer"
    );
    expect(invites.find((invite) => invite.email === "new@example.com").status).toBe(
      "pending"
    );
  });
});

describe("client invitation copy", () => {
  test("the button stays Accept invitation and the sentence follows the account", () => {
    const created = clientInvitationCopy({
      companyName: "Agritech",
      roleLabel: "Project Manager",
      expiresInDays: 2,
      existing: false,
    });
    const existing = clientInvitationCopy({
      companyName: "Agritech",
      roleLabel: "Project Manager",
      expiresInDays: 2,
      existing: true,
    });
    expect(created.button).toBe("Accept invitation");
    expect(existing.button).toBe("Accept invitation");
    expect(created.body).toBe(
      "Click the Accept invitation button to set up your NuBred account and join Agritech as Project Manager. This invitation expires in 2 days."
    );
    expect(existing.body).toBe(
      "Click the Accept invitation button to join Agritech as Project Manager. This invitation expires in 2 days."
    );
    expect(existing.heading).toBe("You're invited to join Agritech");
  });
});

describe("serialize client invites", () => {
  test("members count excludes pending people, and a pending owner still supplies the email", () => {
    const tenant = {
      id: "t1",
      name: "Co",
      status: "active",
      maxProjects: 1,
      slug: "co",
      createdAt: new Date("2026-11-11T00:00:00.000Z"),
      users: [],
      modules: [],
      invites: [
        {
          email: "owner@example.com",
          role: "owner",
          status: "pending",
          expiresAt: later(),
        },
        {
          email: "old@example.com",
          role: "viewer",
          status: "pending",
          expiresAt: earlier(),
        },
      ],
    };
    const list = serializeClientListItem(tenant);
    expect(list.usersCount).toBe(0);
    expect(list.email).toBe("owner@example.com");
    const detail = serializeClientDetail(tenant, usage);
    expect(detail.pendingInvites).toHaveLength(1);
    expect(detail.pendingInvites[0].email).toBe("owner@example.com");
    expect(detail.users).toEqual([]);
  });
});
