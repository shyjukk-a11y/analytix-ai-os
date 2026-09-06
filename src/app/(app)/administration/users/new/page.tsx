import { PageHeader } from '@/components/ui/PageHeader';
import { Card, CardBody } from '@/components/ui/Card';
import { NewUserForm } from '@/components/administration/NewUserForm';

export default function NewUserPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="New User"
        subtitle="Create a real account with sign-in access. Share the temporary password with the new user directly — Phase 1 has no self-service reset or real SSO yet."
      />
      <Card>
        <CardBody>
          <NewUserForm />
        </CardBody>
      </Card>
    </div>
  );
}
