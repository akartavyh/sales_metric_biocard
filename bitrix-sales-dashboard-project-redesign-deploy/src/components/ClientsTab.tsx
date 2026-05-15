import { useMemo } from "react";
import { DataTable, DataTableColumn } from "./DataTable";
import { KpiCard } from "./KpiCard";
import {
  ClientCallStatusClean,
  ForgottenClientRow,
  ForgottenThreshold,
  ManagerBaseContributionRow,
} from "../types";
import { formatDateTime, formatPercent } from "../lib/dates";

interface ClientsTabProps {
  coverageRows: ForgottenClientRow[];
  contributionRows: ManagerBaseContributionRow[];
  selectedStatus: "ALL" | ClientCallStatusClean;
  selectedManager: string;
  managerOptions: string[];
  forgottenThreshold: ForgottenThreshold;
  searchCompany: string;
  searchContact: string;
  searchPhone: string;
  onStatusChange: (value: "ALL" | ClientCallStatusClean) => void;
  onManagerChange: (value: string) => void;
  onThresholdChange: (value: ForgottenThreshold) => void;
  onSearchCompanyChange: (value: string) => void;
  onSearchContactChange: (value: string) => void;
  onSearchPhoneChange: (value: string) => void;
  kpis: {
    companies: number;
    contacts: number;
    phones: number;
    uniquePhones: number;
    calledUniquePhones: number;
    uncalledUniquePhones: number;
    coveragePercent: number;
    forgottenClientsCount: number;
  };
}

function thresholdToValue(value: ForgottenThreshold): string {
  return value === "never" ? "never" : String(value);
}

export function ClientsTab({
  coverageRows,
  contributionRows,
  selectedStatus,
  selectedManager,
  managerOptions,
  forgottenThreshold,
  searchCompany,
  searchContact,
  searchPhone,
  onStatusChange,
  onManagerChange,
  onThresholdChange,
  onSearchCompanyChange,
  onSearchContactChange,
  onSearchPhoneChange,
  kpis,
}: ClientsTabProps) {
  const filteredCoverageRows = useMemo(
    () =>
      coverageRows.filter((row) => {
        const matchesStatus = selectedStatus === "ALL" || row.status === selectedStatus;
        const matchesManager =
          selectedManager === "ALL" ||
          row.lastManager === selectedManager ||
          row.managers.includes(selectedManager);
        const matchesCompany = row.company.toLowerCase().includes(searchCompany.trim().toLowerCase());
        const matchesContact = row.contact.toLowerCase().includes(searchContact.trim().toLowerCase());
        const matchesPhone =
          row.phoneNumber.toLowerCase().includes(searchPhone.trim().toLowerCase()) ||
          row.normalizedPhone.includes(searchPhone.trim());

        return matchesStatus && matchesManager && matchesCompany && matchesContact && matchesPhone;
      }),
    [coverageRows, searchCompany, searchContact, searchPhone, selectedManager, selectedStatus],
  );

  const forgottenColumns: Array<DataTableColumn<ForgottenClientRow>> = [
    { key: "company", header: "Компания", accessor: (row) => row.company },
    { key: "contact", header: "Контакт", accessor: (row) => row.contact },
    {
      key: "phoneNumber",
      header: "Номер телефона",
      accessor: (row) => row.phoneNumber,
      render: (row) => (
        <div className="phone-cell">
          <span>{row.phoneNumber || "—"}</span>
          {row.phoneNumber ? (
            <button
              type="button"
              className="copy-button"
              onClick={() => navigator.clipboard.writeText(row.phoneNumber)}
            >
              Копировать
            </button>
          ) : null}
        </div>
      ),
    },
    {
      key: "status",
      header: "Статус прозвона",
      accessor: (row) => row.status,
      cellClassName: (row) => (row.status !== "В работе" ? "cell-danger" : undefined),
    },
    {
      key: "lastCallDate",
      header: "Последний звонок",
      accessor: (row) => formatDateTime(row.lastCallDate),
      sortValue: (row) => row.lastCallDate?.getTime() ?? 0,
    },
    {
      key: "daysWithoutCall",
      header: "Дней без звонка",
      accessor: (row) => (row.daysWithoutCall == null ? "—" : row.daysWithoutCall),
      sortValue: (row) => row.daysWithoutCall ?? -1,
      align: "right",
    },
    { key: "callCount", header: "Количество звонков", accessor: (row) => row.callCount, align: "right" },
    { key: "lastManager", header: "Последний менеджер", accessor: (row) => row.lastManager || "—" },
    {
      key: "managers",
      header: "Все менеджеры",
      accessor: (row) => (row.managers.length ? row.managers.join(", ") : "—"),
    },
    {
      key: "normalizedPhone",
      header: "Нормализованный телефон",
      accessor: (row) => row.normalizedPhone,
    },
  ];

  const contributionColumns: Array<DataTableColumn<ManagerBaseContributionRow>> = [
    { key: "manager", header: "Менеджер", accessor: (row) => row.manager },
    {
      key: "uniquePhonesCalled",
      header: "Уникальных телефонов из базы прозвонено менеджером",
      accessor: (row) => row.uniquePhonesCalled,
      align: "right",
    },
    {
      key: "shareOfTotalBase",
      header: "Доля в общей базе, %",
      accessor: (row) => formatPercent(row.shareOfTotalBase),
      sortValue: (row) => row.shareOfTotalBase,
      align: "right",
    },
    {
      key: "shareOfReachedBase",
      header: "Доля в прозвоненной базе, %",
      accessor: (row) => formatPercent(row.shareOfReachedBase),
      sortValue: (row) => row.shareOfReachedBase,
      align: "right",
    },
    {
      key: "lastTouchPhones",
      header: "Контактов, где менеджер был последним касанием",
      accessor: (row) => row.lastTouchPhones,
      align: "right",
    },
    {
      key: "averageDaysSinceLastTouch",
      header: "Средняя давность последнего касания, дней",
      accessor: (row) => row.averageDaysSinceLastTouch.toFixed(1),
      sortValue: (row) => row.averageDaysSinceLastTouch,
      align: "right",
    },
  ];

  return (
    <div className="tab-layout">
      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Клиентская база</h2>
            <p>Поиск непрозвоненных и забытых клиентов по общей базе контактов.</p>
          </div>
        </div>

        <div className="kpi-grid">
          <KpiCard title="Всего компаний" value={String(kpis.companies)} />
          <KpiCard title="Всего контактов" value={String(kpis.contacts)} />
          <KpiCard title="Всего телефонов" value={String(kpis.phones)} />
          <KpiCard title="Уникальных телефонов" value={String(kpis.uniquePhones)} />
          <KpiCard title="Прозвонено уникальных телефонов" value={String(kpis.calledUniquePhones)} />
          <KpiCard title="Не прозвонено уникальных телефонов" value={String(kpis.uncalledUniquePhones)} />
          <KpiCard
            title="% проработки базы"
            value={formatPercent(kpis.coveragePercent)}
            tone={kpis.coveragePercent < 50 ? "danger" : "success"}
          />
          <KpiCard
            title="Забытые клиенты"
            value={String(kpis.forgottenClientsCount)}
            tone={kpis.forgottenClientsCount > 0 ? "danger" : "default"}
          />
        </div>
      </section>

      <section className="panel">
        <div className="section-header">
          <div>
            <h2>Фильтры по клиентам</h2>
            <p>Дополнительный анализ по статусу, менеджеру и полям клиента.</p>
          </div>
        </div>

        <div className="filters-grid filters-grid--clients">
          <label className="filter-control">
            <span className="field-label">Статус</span>
            <select
              value={selectedStatus}
              onChange={(event) => onStatusChange(event.target.value as "ALL" | ClientCallStatusClean)}
            >
              <option value="ALL">Все</option>
              <option value="Не звонили">Не звонили</option>
              <option value="Забытый клиент">Забытые клиенты</option>
              <option value="В работе">В работе</option>
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

          <label className="filter-control">
            <span className="field-label">Порог забытых клиентов</span>
            <select
              value={thresholdToValue(forgottenThreshold)}
              onChange={(event) =>
                onThresholdChange(event.target.value === "never" ? "never" : Number(event.target.value) as ForgottenThreshold)
              }
            >
              <option value="never">Не звонили вообще</option>
              <option value="7">Не звонили 7+ дней</option>
              <option value="14">Не звонили 14+ дней</option>
              <option value="30">Не звонили 30+ дней</option>
              <option value="60">Не звонили 60+ дней</option>
              <option value="90">Не звонили 90+ дней</option>
            </select>
          </label>

          <label className="filter-control">
            <span className="field-label">Поиск по компании</span>
            <input
              type="search"
              value={searchCompany}
              onChange={(event) => onSearchCompanyChange(event.target.value)}
              placeholder="Компания"
            />
          </label>

          <label className="filter-control">
            <span className="field-label">Поиск по контакту</span>
            <input
              type="search"
              value={searchContact}
              onChange={(event) => onSearchContactChange(event.target.value)}
              placeholder="Контакт"
            />
          </label>

          <label className="filter-control">
            <span className="field-label">Поиск по телефону</span>
            <input
              type="search"
              value={searchPhone}
              onChange={(event) => onSearchPhoneChange(event.target.value)}
              placeholder="Телефон"
            />
          </label>
        </div>
      </section>

      <DataTable
        title="Забытые клиенты"
        rows={filteredCoverageRows}
        columns={forgottenColumns}
        exportName="forgotten-clients"
        defaultSort={{ key: "status", direction: "asc" }}
        searchPlaceholder="Поиск внутри таблицы забытых клиентов"
      />

      <DataTable
        title="Вклад менеджера в проработку общей базы"
        rows={contributionRows}
        columns={contributionColumns}
        exportName="manager-base-contribution"
        defaultSort={{ key: "lastTouchPhones", direction: "desc" }}
        searchPlaceholder="Поиск по менеджеру"
      />

      <section className="panel note-panel">
        <p>
          Показатель отражает вклад менеджера в прозвон общей клиентской базы.
          Это не персональная проработка собственной базы, так как в текущей выгрузке
          нет поля ответственного менеджера за компанию или контакт.
        </p>
      </section>
    </div>
  );
}
