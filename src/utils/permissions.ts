import { GroupMember, MemberRole, Group } from '../types';

export function getMemberRole(members: GroupMember[], userUid: string, group?: Group): MemberRole | 'owner' | null {
  if (group && group.createdBy === userUid) {
    return 'owner';
  }
  const member = members.find(m => m.uid === userUid);
  if (!member) return null;
  return member.role;
}

export function canManageGroupSettings(role: MemberRole | 'owner' | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function canManageMembers(role: MemberRole | 'owner' | null): boolean {
  return role === 'owner' || role === 'admin';
}

export function canDeleteGroup(role: MemberRole | 'owner' | null, group: Group, userUid: string): boolean {
  return group.createdBy === userUid || role === 'owner';
}

export function canDeleteExpense(role: MemberRole | 'owner' | null, expensePayerId: string, userUid: string): boolean {
  return role === 'owner' || role === 'admin' || expensePayerId === userUid;
}

export function canEditExpense(role: MemberRole | 'owner' | null, expensePayerId: string, userUid: string): boolean {
  return role === 'owner' || role === 'admin' || expensePayerId === userUid;
}
