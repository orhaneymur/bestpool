import { useAuth } from '@/context/AuthContext.jsx';
import PageHeader from '@/components/layout/PageHeader.jsx';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.jsx';
import { APP_VERSION, APP_BUILD, APP_LABEL } from '@/version.js';

const roleLabel = {
  admin: 'Administrator',
  sales: 'Office Staff / Manager',
  viewer: 'Read Only',
};

export default function Profile() {
  const { user } = useAuth();

  return (
    <div className="space-y-5">
      <PageHeader
        title="User Profile"
        subtitle="Signed-in account for Four Seasons Commercial Contract App"
      />
      <Card>
        <CardHeader>
          <CardTitle>{user?.name || 'User'}</CardTitle>
          <CardDescription>{user?.email}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between gap-4 border-b border-border py-2">
            <span className="text-muted-foreground">Role</span>
            <span className="font-medium">{roleLabel[user?.role] || user?.role || '—'}</span>
          </div>
          <div className="flex justify-between gap-4 border-b border-border py-2">
            <span className="text-muted-foreground">App version</span>
            <span className="font-medium">
              v{APP_VERSION} <span className="font-mono text-xs text-muted-foreground">{APP_BUILD}</span>
            </span>
          </div>
          <div className="flex justify-between gap-4 py-2">
            <span className="text-muted-foreground">Release</span>
            <span className="font-medium">{APP_LABEL}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
