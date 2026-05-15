import { WorkbookValidationResult } from "../types";

interface DataQualityPanelProps {
  validation: WorkbookValidationResult;
  warningMessages: string[];
}

export function DataQualityPanel({
  validation,
  warningMessages,
}: DataQualityPanelProps) {
  return (
    <section className="panel">
      <div className="section-header">
        <div>
          <h2>Проверка данных</h2>
          <p>Контроль доступности таблиц и обязательных колонок.</p>
        </div>
      </div>

      <div className="quality-summary">
        {Object.entries(validation.tableDetails).map(([tableName, details]) => (
          <div key={tableName} className="quality-card">
            <strong>{tableName}</strong>
            <span>{details.rowCount} строк</span>
            <span>Колонки: {details.foundColumns.length} / {details.requiredColumns.length}</span>
          </div>
        ))}
      </div>

      <div className="quality-grid">
        <div className="quality-list">
          <h3>Найдены таблицы</h3>
          <ul>
            {validation.foundTables.length ? (
              validation.foundTables.map((tableName) => <li key={tableName}>{tableName}</li>)
            ) : (
              <li>Нет найденных таблиц</li>
            )}
          </ul>
        </div>

        <div className="quality-list">
          <h3>Отсутствуют таблицы</h3>
          <ul>
            {validation.missingTables.length ? (
              validation.missingTables.map((tableName) => <li key={tableName}>{tableName}</li>)
            ) : (
              <li>Все обязательные таблицы найдены</li>
            )}
          </ul>
        </div>
      </div>

      <div className="quality-grid">
        {Object.entries(validation.tableDetails).map(([tableName, details]) => (
          <div key={tableName} className="quality-list">
            <h3>{tableName}</h3>
            <p>Найдены обязательные колонки: {details.foundColumns.join(", ") || "—"}</p>
            <p>
              Отсутствуют обязательные колонки:{" "}
              {details.missingColumns.length ? details.missingColumns.join(", ") : "Нет"}
            </p>
          </div>
        ))}
      </div>

      {warningMessages.length ? (
        <div className="warning-box">
          <h3>Предупреждения</h3>
          <ul>
            {warningMessages.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
