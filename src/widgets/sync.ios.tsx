import { iosWidget } from '@/widgets/twin-ios-widget.ios';
import { readWidgetSnapshot } from '@/widgets/widget-snapshot';

export async function syncWidget(): Promise<void> {
  try {
    iosWidget.updateSnapshot({ snapshot: readWidgetSnapshot() });
  } catch {
    // Best-effort; never crash the app over a widget refresh.
  }
}
