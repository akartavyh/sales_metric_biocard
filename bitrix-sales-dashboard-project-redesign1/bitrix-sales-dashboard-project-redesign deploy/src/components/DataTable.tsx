import { ReactNode, useMemo, useState } from "react";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  accessor?: (row: T) => unknown;
  render?: (row: T) => ReactNode;
  exportValue?: (row: T) => unknown;
  sortValue?: (row: T) => string | number;
  searchValue?: (row: T) => string;
  align?: "left" | "center" | "right";
  cellClassName?: (row: T) => string | undefined;
}

interface DataTableProps<T> {
  title: string;
  rows: T[];
  columns: Array<DataTableColumn<T>>;
  exportName: string;
  defaultSort?: {
    key: string;
    direction: "asc" | "desc";
  };
  searchPlaceholder?: string;
  emptyText?: string;
}

type SortDirection = "asc" | "desc";

export function DataTable<T>({
  title,
  rows,
  columns,
  defaultSort,
  searchPlaceholder = "Поиск по таблице",
  emptyText = "Нет данных для отображения",
}: DataTableProps<T>) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState(defaultSort?.key ?? columns[0]?.key);
  const [sortDirection, setSortDirection] = useState<SortDirection>(defaultSort?.direction ?? "asc");

  const filteredRows = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    if (!normalizedSearch) {
      return rows;
    }

    return rows.filter((row) =>
      columns.some((column) => {
        const rawValue = column.searchValue?.(row) ?? column.accessor?.(row);
        return String(rawValue ?? "")
          .toLowerCase()
          .includes(normalizedSearch);
      }),
    );
  }, [columns, rows, search]);

  const sortedRows = useMemo(() => {
    const activeColumn = columns.find((column) => column.key === sortKey);
    if (!activeColumn) {
      return filteredRows;
    }

    const direction = sortDirection === "asc" ? 1 : -1;
    return [...filteredRows].sort((left, right) => {
      const leftValue = activeColumn.sortValue?.(left) ?? activeColumn.accessor?.(left) ?? "";
      const rightValue = activeColumn.sortValue?.(right) ?? activeColumn.accessor?.(right) ?? "";

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return (leftValue - rightValue) * direction;
      }

      return String(leftValue).localeCompare(String(rightValue), "ru", {
        numeric: true,
        sensitivity: "base",
      }) * direction;
    });
  }, [columns, filteredRows, sortDirection, sortKey]);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection("asc");
  };

  return (
    <section className="panel">
      <div className="section-header section-header--table">
        <div>
          <h2>{title}</h2>
          <p>Строк в текущей выборке: {sortedRows.length}</p>
        </div>

        <div className="table-toolbar">
          <input
            className="search-input"
            type="search"
            value={search}
            placeholder={searchPlaceholder}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
      </div>

      <div className="table-wrapper">
        <table className="data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`align-${column.align ?? "left"}`}
                  onClick={() => handleSort(column.key)}
                >
                  <button type="button" className="sort-button">
                    {column.header}
                    {sortKey === column.key ? (sortDirection === "asc" ? " ↑" : " ↓") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.length ? (
              sortedRows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`align-${column.align ?? "left"} ${column.cellClassName?.(row) ?? ""}`}
                    >
                      {column.render?.(row) ?? String(column.accessor?.(row) ?? "")}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={columns.length} className="empty-cell">
                  {emptyText}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
