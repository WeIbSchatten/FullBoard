import { useRouter } from 'expo-router';

import { PanelForm } from '@/components/PanelForm';
import { Screen } from '@/components/ui';

export default function AddPanel() {
  const router = useRouter();
  return (
    <Screen>
      <PanelForm onAdded={() => router.back()} />
    </Screen>
  );
}
