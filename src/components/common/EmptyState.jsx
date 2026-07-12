import { AlertCircle, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Standard empty/error render for entity-backed lists (pairs with
 * `useEntityList` from `@/hooks/useEntityList`). Never render a silently
 * blank table — show one of these instead.
 *
 * @param {object} props
 * @param {string|null} [props.error]   error message → red error variant
 * @param {string} [props.title]        empty-variant headline
 * @param {string} [props.description]  empty-variant sub-line
 * @param {{ label: string, fn: () => void }} [props.action]
 *        retry / call-to-action button for either variant
 * @param {import("react").ComponentType<{className?: string}>} [props.icon]
 *        empty-variant icon (defaults to Inbox)
 */
export default function EmptyState({ error, title = "Nothing here yet", description, action, icon: Icon = Inbox }) {
  if (error) {
    return (
      <div className="flex flex-col items-center py-12 px-4 text-center" role="alert">
        <AlertCircle className="w-10 h-10 text-red-400 mb-3" />
        <p className="text-sm font-medium text-red-600">{error}</p>
        {action && (
          <Button variant="outline" size="sm" className="mt-4" onClick={action.fn}>
            {action.label}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-12 px-4 text-center text-muted-foreground">
      <Icon className="w-10 h-10 text-slate-300 mb-3" />
      <p className="font-medium text-slate-700">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
      {action && (
        <Button size="sm" className="mt-4 bg-purple-600 hover:bg-purple-700" onClick={action.fn}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
