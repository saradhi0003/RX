import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Home, Users, BookOpen, Settings, X, ShieldCheck, Mail, ChevronRight } from "lucide-react";
import { createPageUrl } from "@/utils";
import { usePermissions } from "@/components/common/PermissionsContext";
import "@/styles/mobile-nav.css";

/**
 * MobileTabNav — the phone navigation.
 *
 * The icon rail is a hover-driven flyout with seven groups. That does not
 * survive a 390pt screen, so on a phone it is replaced outright (the rail is
 * `display:none` under 768px) by four tabs: Home, Recruiting, Playbooks,
 * Settings.
 *
 * Four tabs cannot cover seven groups, so the Settings tab doubles as the
 * catch-all: its sheet carries the real settings pages AND every group that
 * has no tab of its own. Nothing the rail could reach becomes unreachable on
 * a phone — which is the whole point, since there is no hamburger to fall
 * back to.
 *
 * Permission gating is not re-implemented here: `visibleItems` is the same
 * function the rail uses, passed in by Layout, so a user cannot reach a
 * destination through the tab bar that the rail would have hidden.
 */

const DASHBOARD_URL = createPageUrl("Dashboard");
const PLAYBOOKS_URL = createPageUrl("Playbooks");
const SECURITY_URL = createPageUrl("Security");
const EMAIL_SETTINGS_URL = createPageUrl("EmailSettings");

/** True settings destinations. Neither is in `navGroups` as a settings item. */
const SETTINGS_LINKS = [
  { title: "Security & 2FA", url: SECURITY_URL, icon: ShieldCheck },
  { title: "Email Settings", url: EMAIL_SETTINGS_URL, icon: Mail },
];

/**
 * Destinations already reachable from a tab or the Settings section above.
 * Listing one again inside a group section would give the same page two rows
 * in the same sheet.
 */
const COVERED_URLS = new Set([DASHBOARD_URL, PLAYBOOKS_URL, SECURITY_URL, EMAIL_SETTINGS_URL]);

const urlOf = (item) => item.matchUrl || item.url;

/**
 * @param {object} props
 * @param {any[]} props.groups                 navGroups from Layout
 * @param {boolean} props.isAdmin
 * @param {(group:any, ctx:{isAdmin:boolean, can:Function}) => any[]} props.visibleItems
 */
export default function MobileTabNav({ groups, isAdmin, visibleItems }) {
  const location = useLocation();
  const { can } = usePermissions();
  // Which sheet is open: "recruiting" | "settings" | null.
  const [sheet, setSheet] = React.useState(null);
  const closeSheet = React.useCallback(() => setSheet(null), []);

  const itemsFor = React.useCallback(
    (group) => (group ? visibleItems(group, { isAdmin, can }) : []),
    [visibleItems, isAdmin, can]
  );

  const recruitingItems = React.useMemo(
    () => itemsFor(groups.find((g) => g.id === "recruiting")),
    [groups, itemsFor]
  );

  // Settings sheet = real settings pages, then every group without a tab.
  // A group whose items are all covered elsewhere (Operations → Playbooks)
  // drops out rather than rendering an empty heading.
  const settingsSections = React.useMemo(() => {
    const sections = [{ label: "Settings", items: SETTINGS_LINKS }];
    for (const group of groups) {
      if (group.id === "recruiting") continue; // has its own tab
      const items = itemsFor(group).filter((it) => !COVERED_URLS.has(urlOf(it)));
      if (items.length) sections.push({ label: group.label, items });
    }
    return sections;
  }, [groups, itemsFor]);

  const path = location.pathname;
  const inRecruiting = recruitingItems.some((it) => urlOf(it) === path);
  const inSettings = settingsSections.some((s) => s.items.some((it) => urlOf(it) === path));

  const tabs = [
    { id: "home", label: "Home", icon: Home, to: DASHBOARD_URL, active: path === DASHBOARD_URL },
    { id: "recruiting", label: "Recruiting", icon: Users, sheet: "recruiting", active: inRecruiting },
    { id: "playbooks", label: "Playbooks", icon: BookOpen, to: PLAYBOOKS_URL, active: path === PLAYBOOKS_URL },
    { id: "settings", label: "Settings", icon: Settings, sheet: "settings", active: inSettings },
  ];

  // A route change means the destination was reached — the sheet must not stay
  // up covering the page the user just asked for.
  React.useEffect(() => { setSheet(null); }, [path]);

  // Escape closes the sheet, as expected of any modal layer.
  React.useEffect(() => {
    if (!sheet) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setSheet(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sheet]);

  // The sheet is a fixed overlay; letting the page scroll behind it is the
  // classic iOS scroll-chaining bug.
  React.useEffect(() => {
    if (!sheet) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [sheet]);

  const openSections = sheet === "recruiting"
    ? [{ label: null, items: recruitingItems }]
    : sheet === "settings" ? settingsSections : [];
  const sheetTitle = sheet === "recruiting" ? "Recruiting" : "Settings";

  return (
    <>
      <nav className="rxmn-bar" aria-label="Primary">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const cls = `rxmn-tab ${tab.active ? "is-active" : ""}`;
          const inner = (
            <>
              <Icon style={{ width: 21, height: 21 }} />
              <span className="rxmn-tab-label">{tab.label}</span>
            </>
          );
          return tab.sheet ? (
            <button
              key={tab.id}
              type="button"
              className={cls}
              onClick={() => setSheet((cur) => (cur === tab.sheet ? null : tab.sheet))}
              aria-expanded={sheet === tab.sheet}
              aria-current={tab.active ? "page" : undefined}
            >
              {inner}
            </button>
          ) : (
            <Link
              key={tab.id}
              to={tab.to}
              className={cls}
              onClick={closeSheet}
              aria-current={tab.active ? "page" : undefined}
            >
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Kept out of the DOM on desktop, where the rail is the navigation. */}
      <div className="rxmn-sheet-root">
        {sheet && (
          <>
            <div className="rxmn-scrim" onClick={closeSheet} aria-hidden="true" />
            <div className="rxmn-sheet" role="dialog" aria-modal="true" aria-label={sheetTitle}>
              <div className="rxmn-grip" />
              <div className="rxmn-sheet-head">
                <span className="rxmn-sheet-title">{sheetTitle}</span>
                <button type="button" className="rxmn-sheet-close" onClick={closeSheet} aria-label="Close menu">
                  <X style={{ width: 17, height: 17 }} />
                </button>
              </div>
              <div className="rxmn-sheet-body">
                {openSections.map((section, i) => (
                  <React.Fragment key={section.label || `section-${i}`}>
                    {section.label && <div className="rxmn-section-label">{section.label}</div>}
                    {section.items.map((item) => {
                      const Icon = item.icon || ChevronRight;
                      const active = urlOf(item) === path;
                      return (
                        <Link
                          key={item.url}
                          to={item.url}
                          className={`rxmn-item ${active ? "is-active" : ""}`}
                          onClick={closeSheet}
                          aria-current={active ? "page" : undefined}
                        >
                          <Icon className="rxmn-item-icon" />
                          <span className="rxmn-item-title">{item.title}</span>
                          {item.badge !== undefined && (
                            <span className={`rxmn-badge ${item.badgeColor || ""}`}>{item.badge}</span>
                          )}
                        </Link>
                      );
                    })}
                  </React.Fragment>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
