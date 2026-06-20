import { ExternalLink } from "lucide-react";
import type { ButtonHTMLAttributes, FormHTMLAttributes, HTMLAttributes, JSX, ReactNode } from "react";

export type SurfaceVariant =
  | "shell"
  | "pane"
  | "panel"
  | "row"
  | "content"
  | "elevated"
  | "overlay"
  | "solid"
  | "status"
  | "danger"
  | "warning"
  | "success";
export type SurfacePadding = "none" | "compact" | "comfortable";
export type StateTone = "neutral" | "accent" | "success" | "warning" | "danger" | "muted";
export type RepositoryDataSource = "github" | "local" | "local-connected-github";

export interface ChipModel {
  id: string;
  label: ReactNode;
  tone?: StateTone;
}

export interface ActionModel {
  id: string;
  label: ReactNode;
  disabledReason?: string | null;
  onClick(): void;
}

export interface RepositoryChromeModel {
  source: RepositoryDataSource;
  displayName: string;
  path?: string | null;
  nameWithOwner?: string | null;
  defaultBranch?: string | null;
  currentBranch?: string | null;
  statusChips: ChipModel[];
  actions: ActionModel[];
}

type SurfaceElement = "div" | "section" | "article" | "aside" | "header" | "main";

function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export interface SurfaceProps extends HTMLAttributes<HTMLElement> {
  as?: SurfaceElement;
  variant?: SurfaceVariant;
  padding?: SurfacePadding;
  selected?: boolean;
}

export function Surface({
  as: Component = "section",
  variant = "panel",
  padding = "comfortable",
  selected = false,
  className,
  ...props
}: SurfaceProps): JSX.Element {
  return (
    <Component
      {...props}
      className={classNames(
        "ui-surface",
        `ui-surface--${variant}`,
        `ui-surface--padding-${padding}`,
        selected && "is-selected",
        className
      )}
    />
  );
}

export interface FilterBarProps extends HTMLAttributes<HTMLDivElement> {
  label?: ReactNode;
  actions?: ReactNode;
}

export function FilterBar({ label, actions, children, className, ...props }: FilterBarProps): JSX.Element {
  return (
    <div {...props} className={classNames("ui-filter-bar", className)}>
      {label && <div className="ui-filter-bar-label">{label}</div>}
      <div className="ui-filter-bar-controls">{children}</div>
      {actions && <div className="ui-filter-bar-actions">{actions}</div>}
    </div>
  );
}

export interface StateSegmentedControlOption<TValue extends string> {
  value: TValue;
  label: ReactNode;
  title?: string | null;
  disabled?: boolean;
  disabledReason?: string | null;
}

export interface StateSegmentedControlProps<TValue extends string> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  label: string;
  value: TValue;
  options: Array<StateSegmentedControlOption<TValue>>;
  onChange(value: TValue): void;
}

export function StateSegmentedControl<TValue extends string>({
  label,
  value,
  options,
  onChange,
  className,
  ...props
}: StateSegmentedControlProps<TValue>): JSX.Element {
  return (
    <div
      {...props}
      className={classNames("ui-state-segmented-control", className)}
      role="group"
      aria-label={label}
    >
      {options.map((option) => {
        const disabled = Boolean(option.disabled || option.disabledReason);

        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={option.value === value}
            disabled={disabled}
            title={option.disabledReason ?? option.title ?? undefined}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  disabledReason?: string | null;
}

export function IconButton({
  label,
  disabledReason,
  className,
  disabled,
  children,
  type = "button",
  ...props
}: IconButtonProps): JSX.Element {
  return (
    <button
      {...props}
      type={type}
      className={classNames("ui-icon-button", className)}
      aria-label={label}
      title={disabledReason ?? props.title ?? label}
      disabled={disabled || Boolean(disabledReason)}
    >
      {children}
    </button>
  );
}

export interface ExternalLinkButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  disabledReason?: string | null;
}

export function ExternalLinkButton({
  disabledReason,
  className,
  children = "Open externally",
  disabled,
  type = "button",
  ...props
}: ExternalLinkButtonProps): JSX.Element {
  return (
    <button
      {...props}
      type={type}
      className={classNames("ui-external-link-button", className)}
      title={disabledReason ?? props.title}
      disabled={disabled || Boolean(disabledReason)}
    >
      <span>{children}</span>
      <ExternalLink size={14} aria-hidden="true" />
    </button>
  );
}

export interface StateChipProps extends HTMLAttributes<HTMLSpanElement> {
  tone?: StateTone;
}

export function StateChip({ tone = "neutral", className, ...props }: StateChipProps): JSX.Element {
  return <span {...props} className={classNames("ui-state-chip", `ui-state-chip--${tone}`, className)} />;
}

export interface DetailLayoutProps extends HTMLAttributes<HTMLDivElement> {
  rail?: ReactNode;
}

export function DetailLayout({ rail, children, className, ...props }: DetailLayoutProps): JSX.Element {
  return (
    <div {...props} className={classNames("ui-detail-layout", className)}>
      <div className="ui-detail-layout-main">{children}</div>
      {rail && <DetailRail>{rail}</DetailRail>}
    </div>
  );
}

export function DetailRail({ className, ...props }: HTMLAttributes<HTMLElement>): JSX.Element {
  return <aside {...props} className={classNames("ui-detail-rail", className)} />;
}

export function RepositoryRightRail(props: HTMLAttributes<HTMLElement>): JSX.Element {
  return <DetailRail {...props} className={classNames("ui-repository-right-rail", props.className)} />;
}

export interface RailSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
}

export function RailSection({
  title,
  actions,
  children,
  className,
  ...props
}: RailSectionProps): JSX.Element {
  return (
    <section {...props} className={classNames("ui-rail-section", className)}>
      {(title || actions) && (
        <header className="ui-rail-section-header">
          {title && <h3>{title}</h3>}
          {actions && <div className="ui-rail-section-actions">{actions}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Timeline({ className, ...props }: HTMLAttributes<HTMLDivElement>): JSX.Element {
  return <div {...props} className={classNames("ui-timeline", className)} />;
}

export interface TimelineEventCardProps extends HTMLAttributes<HTMLElement> {
  marker?: ReactNode;
}

export function TimelineEventCard({
  marker,
  children,
  className,
  ...props
}: TimelineEventCardProps): JSX.Element {
  return (
    <article {...props} className={classNames("ui-timeline-event-card", className)}>
      <div className="ui-timeline-event-marker" aria-hidden={marker ? undefined : "true"}>
        {marker}
      </div>
      <div className="ui-timeline-event-body">{children}</div>
    </article>
  );
}

export interface ComposerProps extends Omit<FormHTMLAttributes<HTMLFormElement>, "title"> {
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
}

export function Composer({
  title,
  actions,
  footer,
  children,
  className,
  ...props
}: ComposerProps): JSX.Element {
  return (
    <form {...props} className={classNames("ui-composer", className)}>
      {(title || actions) && (
        <header className="ui-composer-header">
          {title && <h3>{title}</h3>}
          {actions && <div>{actions}</div>}
        </header>
      )}
      <div className="ui-composer-body">{children}</div>
      {footer && <footer className="ui-composer-footer">{footer}</footer>}
    </form>
  );
}

export interface FormSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function FormSection({
  title,
  description,
  actions,
  children,
  className,
  ...props
}: FormSectionProps): JSX.Element {
  return (
    <section {...props} className={classNames("ui-form-section", className)}>
      {(title || description || actions) && (
        <header className="ui-form-section-header">
          <div>
            {title && <h3>{title}</h3>}
            {description && <p>{description}</p>}
          </div>
          {actions && <div>{actions}</div>}
        </header>
      )}
      <div className="ui-form-section-body">{children}</div>
    </section>
  );
}

export interface AvailabilityBannerProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Exclude<StateTone, "accent">;
}

export function AvailabilityBanner({
  tone = "neutral",
  className,
  ...props
}: AvailabilityBannerProps): JSX.Element {
  return <div {...props} className={classNames("ui-availability-banner", `ui-tone--${tone}`, className)} />;
}

export interface EmptyStateProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function EmptyState({
  title,
  description,
  actions,
  className,
  ...props
}: EmptyStateProps): JSX.Element {
  return (
    <div {...props} className={classNames("ui-empty-state", className)}>
      <strong>{title}</strong>
      {description && <p>{description}</p>}
      {actions && <div>{actions}</div>}
    </div>
  );
}

export interface LimitHitNoticeProps extends HTMLAttributes<HTMLDivElement> {
  shown: number;
  limit: number;
}

export function LimitHitNotice({
  shown,
  limit,
  className,
  children,
  ...props
}: LimitHitNoticeProps): JSX.Element | null {
  if (shown < limit) {
    return null;
  }

  return (
    <AvailabilityBanner {...props} tone="muted" className={classNames("ui-limit-hit-notice", className)}>
      {children ?? `Showing the first ${limit} results.`}
    </AvailabilityBanner>
  );
}

export interface RepositoryHeroProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  model?: RepositoryChromeModel;
  leading?: ReactNode;
  eyebrow?: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  chips?: ReactNode;
  actions?: ReactNode;
}

export function RepositoryHero({
  model,
  leading,
  eyebrow,
  title,
  subtitle,
  chips,
  actions,
  children,
  className,
  ...props
}: RepositoryHeroProps): JSX.Element {
  const renderedTitle = title ?? model?.displayName;
  const renderedSubtitle = subtitle ?? model?.nameWithOwner ?? model?.path ?? null;
  const renderedChips =
    chips ??
    model?.statusChips.map((chip) => (
      <StateChip key={chip.id} tone={chip.tone}>
        {chip.label}
      </StateChip>
    ));
  const renderedActions =
    actions ??
    model?.actions.map((action) => (
      <button
        key={action.id}
        type="button"
        disabled={Boolean(action.disabledReason)}
        title={action.disabledReason ?? undefined}
        onClick={action.onClick}
      >
        {action.label}
      </button>
    ));

  return (
    <header {...props} className={classNames("ui-repository-hero", className)}>
      {leading && <div className="ui-repository-hero-leading">{leading}</div>}
      <div className="ui-repository-hero-main">
        {eyebrow && <span className="ui-repository-hero-eyebrow">{eyebrow}</span>}
        {(renderedTitle || renderedChips) && (
          <div className="ui-repository-hero-title-row">
            {renderedTitle && <h1>{renderedTitle}</h1>}
            {renderedChips && <div className="ui-repository-hero-chips">{renderedChips}</div>}
          </div>
        )}
        {renderedSubtitle && <p>{renderedSubtitle}</p>}
        {children}
      </div>
      {renderedActions && <div className="ui-repository-hero-actions">{renderedActions}</div>}
    </header>
  );
}

export interface RepositoryTabOption<TValue extends string> {
  value: TValue;
  label: ReactNode;
  count?: number | null;
  disabled?: boolean;
  disabledReason?: string | null;
}

export interface RepositoryTabsProps<TValue extends string> extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "onChange"
> {
  label: string;
  value: TValue;
  tabs: Array<RepositoryTabOption<TValue>>;
  onChange(value: TValue): void;
}

export function RepositoryTabs<TValue extends string>({
  label,
  value,
  tabs,
  onChange,
  className,
  ...props
}: RepositoryTabsProps<TValue>): JSX.Element {
  return (
    <nav {...props} className={classNames("ui-repository-tabs", className)} aria-label={label}>
      {tabs.map((tab) => {
        const disabled = Boolean(tab.disabled || tab.disabledReason);

        return (
          <button
            key={tab.value}
            type="button"
            aria-current={tab.value === value ? "page" : undefined}
            disabled={disabled}
            title={tab.disabledReason ?? undefined}
            onClick={() => onChange(tab.value)}
          >
            <span>{tab.label}</span>
            {tab.count !== null && tab.count !== undefined && <StateChip tone="muted">{tab.count}</StateChip>}
          </button>
        );
      })}
    </nav>
  );
}

export function RepositoryTabSurface(props: SurfaceProps): JSX.Element {
  return <Surface {...props} className={classNames("ui-repository-tab-surface", props.className)} />;
}

export interface RepositoryChromeProps extends HTMLAttributes<HTMLDivElement> {
  hero: ReactNode;
  tabs?: ReactNode;
  rail?: ReactNode;
}

export function RepositoryChrome({
  hero,
  tabs,
  rail,
  children,
  className,
  ...props
}: RepositoryChromeProps): JSX.Element {
  return (
    <div {...props} className={classNames("ui-repository-chrome", className)}>
      {hero}
      {tabs}
      <DetailLayout rail={rail}>{children}</DetailLayout>
    </div>
  );
}
