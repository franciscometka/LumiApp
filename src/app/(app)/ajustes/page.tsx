import { PageShell } from '@/components/layout/page-shell';
import { SettingsView } from '@/features/settings/settings-view';

export default function AjustesPage() {
  return (
    <PageShell title="Ajustes" description="Preferências e backup dos seus dados.">
      <SettingsView />
    </PageShell>
  );
}
