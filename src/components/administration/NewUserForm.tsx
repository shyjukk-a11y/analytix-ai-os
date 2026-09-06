'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createUser } from '@/lib/actions/users';
import { Input, Label, Select, FormRow } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ROLE_LABELS } from '@/lib/rbac';
import { Role } from '@/lib/enums';

export function NewUserForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        const formData = new FormData(e.currentTarget);
        startTransition(async () => {
          try {
            await createUser(formData);
            router.push('/administration/users');
            router.refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Could not create user.');
          }
        });
      }}
      className="space-y-4"
    >
      <FormRow>
        <div>
          <Label htmlFor="name">Full name</Label>
          <Input id="name" name="name" placeholder="Jordan Blake" required />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" placeholder="jordan.blake@analytix.com" required />
        </div>
      </FormRow>
      <FormRow>
        <div>
          <Label htmlFor="password" hint="(min. 8 characters)">Temporary password</Label>
          <Input id="password" name="password" type="password" minLength={8} required />
        </div>
        <div>
          <Label htmlFor="role">Role</Label>
          <Select id="role" name="role" defaultValue="" required>
            <option value="" disabled>
              — Select —
            </option>
            {Object.values(Role).map((role) => (
              <option key={role} value={role}>
                {ROLE_LABELS[role]}
              </option>
            ))}
          </Select>
        </div>
      </FormRow>
      <div>
        <Label htmlFor="jobTitle" hint="(optional)">
          Job title
        </Label>
        <Input id="jobTitle" name="jobTitle" placeholder="Case Officer" />
      </div>
      <div className="flex items-center justify-end gap-3 pt-2">
        {error ? <p className="mr-auto text-sm text-status-critical">{error}</p> : null}
        <Button type="submit" disabled={isPending}>
          {isPending ? 'Creating…' : 'Create User'}
        </Button>
      </div>
    </form>
  );
}
