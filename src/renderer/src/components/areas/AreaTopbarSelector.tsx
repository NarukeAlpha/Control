import { ChevronDown, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type JSX } from "react";

import type { AreaSummary } from "@shared/areas";

import { isGatewayAreaKind } from "./areaUi";

export function AreaTopbarSelector({
  areas,
  selectedAreaId,
  onSelectArea,
  onAddLocalArea,
  onAddSshArea,
  onEditArea,
  onDeleteArea
}: {
  areas: AreaSummary[];
  selectedAreaId: string | null;
  onSelectArea(areaId: string): void;
  onAddLocalArea(): void;
  onAddSshArea(): void;
  onEditArea(area: AreaSummary): void;
  onDeleteArea(area: AreaSummary): void;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const [actionAreaId, setActionAreaId] = useState<string | null>(null);
  const selectedArea =
    areas.find((area) => area.id === selectedAreaId) ??
    areas.find((area) => area.selected) ??
    areas.find((area) => area.kind === "github") ??
    null;
  const label = selectedArea?.label ?? "GitHub";
  const mark = selectedArea?.kind === "local" ? "L" : selectedArea?.kind === "ssh" ? "S" : "GH";

  return (
    <div
      className="area-topbar-selector"
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
        }
      }}
    >
      <button
        className="titlebar-provider-button area-topbar-button"
        type="button"
        aria-label={`Select Area: ${label}`}
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="brand-mark">{mark}</span>
        <span>{label}</span>
        <ChevronDown size={14} />
      </button>
      {open && (
        <div className="area-topbar-menu" role="menu">
          {areas.map((area) => {
            const actionsOpen = actionAreaId === area.id;
            return (
              <div
                className={`area-menu-row ${selectedArea?.id === area.id ? "selected" : ""}`}
                key={area.id}
                role="none"
              >
                <button
                  className="area-menu-item"
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectArea(area.id);
                    setOpen(false);
                    setActionAreaId(null);
                  }}
                >
                  <span className="repo-avatar">
                    {area.kind === "github" ? "G" : area.kind === "ssh" ? "S" : "L"}
                  </span>
                  <span className="repo-copy">
                    <span className="repo-name">{area.label}</span>
                    <span className="repo-meta">
                      {isGatewayAreaKind(area.kind) ? `${area.repositoryCount} repositories` : area.subtitle}
                    </span>
                  </span>
                </button>
                <button
                  className="area-menu-more"
                  type="button"
                  aria-label={`Area actions for ${area.label}`}
                  aria-expanded={actionsOpen}
                  onClick={(event) => {
                    event.stopPropagation();
                    setActionAreaId(actionsOpen ? null : area.id);
                  }}
                >
                  <MoreHorizontal size={15} />
                </button>
                {actionsOpen && (
                  <div className="area-actions-menu" role="menu" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onEditArea(area);
                        setActionAreaId(null);
                        setOpen(false);
                      }}
                    >
                      <Pencil size={14} />
                      <span>Edit Area</span>
                    </button>
                    {area.kind === "github" ? (
                      <button
                        className="area-action-delete"
                        type="button"
                        role="menuitem"
                        aria-disabled="true"
                        title="Default GitHub Area cannot be deleted"
                      >
                        <Trash2 size={14} />
                        <span>Delete Area</span>
                      </button>
                    ) : (
                      <AreaArmedDeleteAction
                        area={area}
                        onDelete={() => {
                          onDeleteArea(area);
                          setActionAreaId(null);
                          setOpen(false);
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button
            className="area-menu-add"
            type="button"
            role="menuitem"
            onClick={() => {
              onAddLocalArea();
              setOpen(false);
            }}
          >
            <Plus size={15} />
            <span>Add local folder Area</span>
          </button>
          <button
            className="area-menu-add"
            type="button"
            role="menuitem"
            onClick={() => {
              onAddSshArea();
              setOpen(false);
            }}
          >
            <Plus size={15} />
            <span>Add SSH Area</span>
          </button>
        </div>
      )}
    </div>
  );
}

function AreaArmedDeleteAction({ area, onDelete }: { area: AreaSummary; onDelete(): void }): JSX.Element {
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<number | null>(null);

  function clearTimer(): void {
    if (armTimer.current) {
      window.clearTimeout(armTimer.current);
      armTimer.current = null;
    }
  }

  function beginArming(): void {
    if (armed || armTimer.current) {
      return;
    }
    setArmed(false);
    armTimer.current = window.setTimeout(() => {
      setArmed(true);
      armTimer.current = null;
    }, 3_000);
  }

  function cancelArming(): void {
    clearTimer();
    setArmed(false);
  }

  useEffect(() => {
    return () => {
      if (armTimer.current) {
        window.clearTimeout(armTimer.current);
      }
    };
  }, []);

  return (
    <button
      className={`area-action-delete ${armed ? "armed" : ""}`}
      type="button"
      role="menuitem"
      aria-disabled={!armed}
      title={armed ? `Delete ${area.label}` : "Hover for 3 seconds to enable delete"}
      onMouseEnter={beginArming}
      onMouseLeave={cancelArming}
      onFocus={beginArming}
      onBlur={cancelArming}
      onClick={(event) => {
        if (!armed) {
          event.preventDefault();
          return;
        }
        onDelete();
      }}
    >
      <Trash2 size={14} />
      <span>Delete Area</span>
    </button>
  );
}
