import { FileUploader } from "./FileUploader";

interface TopFiltersProps {
  fileName?: string;
  managerOptions: string[];
  selectedLeaderGroup: "ALL" | "KAMINSKAYA" | "MASHENKOV";
  selectedManager: string;
  selectedMonth: string;
  workingDaysInMonth: number;
  onLeaderGroupChange: (value: "ALL" | "KAMINSKAYA" | "MASHENKOV") => void;
  onManagerChange: (value: string) => void;
  onMonthChange: (value: string) => void;
  onFileSelect: (file: File) => void;
  onReset: () => void;
}

export function TopFilters({
  fileName,
  managerOptions,
  selectedLeaderGroup,
  selectedManager,
  selectedMonth,
  workingDaysInMonth,
  onLeaderGroupChange,
  onManagerChange,
  onMonthChange,
  onFileSelect,
  onReset,
}: TopFiltersProps) {
  return (
    <section className="panel top-filters">
      <div className="filters-grid">
        <FileUploader fileName={fileName} onFileSelect={onFileSelect} />

        <label className="filter-control">
          <span className="field-label">Месяц</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(event) => onMonthChange(event.target.value)}
          />
        </label>

        <label className="filter-control">
          <span className="field-label">Группа руководителя</span>
          <select
            value={selectedLeaderGroup}
            onChange={(event) => onLeaderGroupChange(event.target.value as "ALL" | "KAMINSKAYA" | "MASHENKOV")}
          >
            <option value="ALL">Все группы</option>
            <option value="KAMINSKAYA">Каминская</option>
            <option value="MASHENKOV">Машенков</option>
          </select>
        </label>

        <label className="filter-control">
          <span className="field-label">Менеджер</span>
          <select
            value={selectedManager}
            onChange={(event) => onManagerChange(event.target.value)}
          >
            <option value="ALL">Все менеджеры</option>
            {managerOptions.map((manager) => (
              <option key={manager} value={manager}>
                {manager}
              </option>
            ))}
          </select>
        </label>

        <div className="filter-control">
          <span className="field-label">Рабочих дней (РФ, на текущую дату)</span>
          <div className="stat-box">{workingDaysInMonth}</div>
        </div>

        <div className="filter-actions">
          <button type="button" className="secondary-button" onClick={onReset}>
            Сбросить фильтры
          </button>
        </div>
      </div>
    </section>
  );
}
