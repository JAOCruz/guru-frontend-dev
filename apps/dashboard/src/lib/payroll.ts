import { USER_COLUMNS } from "../services/excelService";
import type { DirectoryUser } from "./userColors";

export interface PayrollList {
  columns: string[];
  inactive: Set<string>;
}

// Employees shown in earnings: active users with "Participa en ganancias",
// plus deactivated ones that still have services in the list being shown.
export function payrollColumns(
  users: DirectoryUser[],
  services: { data_column?: string | null }[],
): PayrollList {
  if (users.length === 0) return { columns: [...USER_COLUMNS], inactive: new Set() };

  const withServices = new Set(services.map((s) => (s.data_column || "").toUpperCase()).filter(Boolean));
  const columns: string[] = [];
  const inactive = new Set<string>();

  [...users]
    .sort((a, b) => a.id - b.id)
    .forEach((user) => {
      const col = (user.data_column || "").toUpperCase();
      if (!user.in_payroll || !col || columns.includes(col)) return;
      if (user.is_active) {
        columns.push(col);
      } else if (withServices.has(col)) {
        columns.push(col);
        inactive.add(col);
      }
    });

  return { columns, inactive };
}
