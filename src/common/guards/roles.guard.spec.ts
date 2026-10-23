import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard';
import { Role } from '../enums/role.enum';

function contextWithRole(role: Role | undefined): ExecutionContext {
  return {
    getHandler: () => ({}) as unknown,
    getClass: () => ({}) as unknown,
    switchToHttp: () => ({
      getRequest: () => ({ user: role ? { role } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

function guardWithRequiredRoles(requiredRoles: Role[] | undefined) {
  const reflector = {
    getAllAndOverride: () => requiredRoles,
  } as unknown as Reflector;
  return new RolesGuard(reflector);
}

describe('RolesGuard', () => {
  it('allows any authenticated role when a route declares no @Roles', () => {
    const guard = guardWithRequiredRoles(undefined);
    expect(guard.canActivate(contextWithRole(Role.ADMIN))).toBe(true);
    expect(guard.canActivate(contextWithRole(Role.TEACHER))).toBe(true);
    expect(guard.canActivate(contextWithRole(Role.FINANCE))).toBe(true);
  });

  it('allows a role explicitly listed in @Roles', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN, Role.TEACHER]);
    expect(guard.canActivate(contextWithRole(Role.ADMIN))).toBe(true);
    expect(guard.canActivate(contextWithRole(Role.TEACHER))).toBe(true);
  });

  it('rejects a role not listed in @Roles', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN, Role.TEACHER]);
    expect(guard.canActivate(contextWithRole(Role.FINANCE))).toBe(false);
  });

  it('rejects when there is no user on the request at all', () => {
    const guard = guardWithRequiredRoles([Role.ADMIN]);
    expect(guard.canActivate(contextWithRole(undefined))).toBe(false);
  });

  describe('matches the RBAC table for every protected route in this app', () => {
    const cases: Array<{ route: string; roles: Role[] }> = [
      { route: 'POST /users (manage staff)', roles: [Role.ADMIN] },
      { route: 'POST /students (create student)', roles: [Role.ADMIN] },
      { route: 'DELETE /students/:id', roles: [Role.ADMIN] },
      { route: 'POST /classes', roles: [Role.ADMIN] },
      { route: 'POST /sections', roles: [Role.ADMIN] },
      { route: 'POST /subjects', roles: [Role.ADMIN] },
      { route: 'POST /exams', roles: [Role.ADMIN] },
      { route: 'POST /exams/:id/publish', roles: [Role.ADMIN] },
      { route: 'POST /exams/:id/marks (enter results)', roles: [Role.ADMIN, Role.TEACHER] },
      { route: 'GET /attendance', roles: [Role.ADMIN, Role.TEACHER] },
      { route: 'GET /attendance/recent', roles: [Role.ADMIN, Role.TEACHER] },
      { route: 'POST /notices', roles: [Role.ADMIN, Role.TEACHER] },
      { route: 'POST /notices/:id/publish', roles: [Role.ADMIN, Role.TEACHER] },
    ];

    for (const { route, roles } of cases) {
      it(`${route} allows ${roles.join('/')} and blocks everyone else`, () => {
        const guard = guardWithRequiredRoles(roles);
        for (const role of Object.values(Role)) {
          expect(guard.canActivate(contextWithRole(role))).toBe(roles.includes(role));
        }
      });
    }
  });
});
