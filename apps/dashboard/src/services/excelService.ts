import * as XLSX from "xlsx";

// Define types for our Excel data
// Payroll employees come from the user directory (users.data_column); any string key
export type WorkerKey = string;

export interface ExcelRow {
  DETALLE?: string;
  Servicio?: string;
  Ganancia?: string | number;
  Valor?: string | number;
  Cliente?: string;
  Hora?: string;
  HENGI?: string | number;
  MARLENI?: string | number;
  ISRAEL?: string | number;
  THAICAR?: string | number;
  AUXILIAR_I?: string | number;
  AUXILIAR_II?: string | number;
  [key: string]: string | number | undefined;
}

// Legacy fixed list — only a fallback while the user directory loads (see lib/payroll.ts)
export const USER_COLUMNS: WorkerKey[] = [
  "HENGI",
  "MARLENI",
  "ISRAEL",
  "THAICAR",
  "AUXILIAR_I",
  "AUXILIAR_II",
];

// Cache mechanism
const cache: {
  data: ExcelRow[] | null;
  timestamp: number | null;
} = {
  data: null,
  timestamp: null,
};

// Cache expiration time in milliseconds (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000;

/**
 * Fetch Excel data from a cloud storage URL
 */
export const fetchExcelData = async (url: string): Promise<ExcelRow[]> => {
  // Check if we have valid cached data
  const now = Date.now();
  if (
    cache.data &&
    cache.timestamp &&
    now - cache.timestamp < CACHE_EXPIRATION
  ) {
    return cache.data;
  }

  try {
    // Fetch the Excel file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch Excel file: ${response.statusText}`);
    }

    // Get the file as array buffer
    const arrayBuffer = await response.arrayBuffer();

    // Parse the Excel file
    const workbook = XLSX.read(arrayBuffer, { type: "array" });

    // Assume first sheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];

    // Convert to JSON
    const data = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);

    // Update cache
    cache.data = data;
    cache.timestamp = now;

    return data;
  } catch (error) {
    console.error("Error fetching or parsing Excel data:", error);
    throw error;
  }
};

/**
 * Get column names from Excel data
 */
export const getColumnNames = (data: ExcelRow[]): string[] => {
  if (data.length === 0) return [];
  return Object.keys(data[0]);
};

/**
 * Filter Excel data based on search term
 */
export const filterData = (
  data: ExcelRow[],
  searchTerm: string,
  userDataColumn?: string | null,
): ExcelRow[] => {
  // First, filter by user access if applicable
  let filteredData = data;

  // If userDataColumn is provided, filter the data to only include relevant columns
  if (userDataColumn) {
    filteredData = data.map((row) => {
      // Create a new object with only the columns the user should see
      const filteredRow: ExcelRow = {};

      // Always include common columns that all users should see
      Object.keys(row).forEach((key) => {
        // Include the user's specific column and any non-user columns
        if (
          key === userDataColumn ||
          !USER_COLUMNS.includes(key as WorkerKey)
        ) {
          filteredRow[key] = row[key];
        }
      });

      return filteredRow;
    });
  }

  // Then apply search term filtering if provided
  if (!searchTerm) return filteredData;

  const lowercasedTerm = searchTerm.toLowerCase();

  return filteredData.filter((row) => {
    return Object.values(row).some((value) => {
      if (value === null || value === undefined) return false;
      return String(value).toLowerCase().includes(lowercasedTerm);
    });
  });
};

/**
 * Sort Excel data by column
 */
export const sortData = (
  data: ExcelRow[],
  sortColumn: string,
  sortDirection: "asc" | "desc",
): ExcelRow[] => {
  return [...data].sort((a, b) => {
    const valueA = a[sortColumn];
    const valueB = b[sortColumn];

    // Handle numeric values
    if (typeof valueA === "number" && typeof valueB === "number") {
      return sortDirection === "asc" ? valueA - valueB : valueB - valueA;
    }

    // Handle string values
    const stringA = String(valueA).toLowerCase();
    const stringB = String(valueB).toLowerCase();

    if (stringA < stringB) return sortDirection === "asc" ? -1 : 1;
    if (stringA > stringB) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });
};

/**
 * Filter data based on user role and access
 */
export const filterDataByUserAccess = (
  data: ExcelRow[],
  userRole: string,
  userDataColumn?: string | null,
): ExcelRow[] => {
  // Admin can see all data
  if (userRole === "admin") {
    return data;
  }

  // Regular users can only see their own data in a simplified format
  if (userRole === "user" && userDataColumn) {
    const userRows: ExcelRow[] = [];
    let totalGanancia = 0;

    const findDetailValue = (
      currentIndex: number,
      detailType: string,
    ): string | number | undefined => {
      const searchOffsets = [-3, -2, -1, 1, 2, 3];

      for (const offset of searchOffsets) {
        const candidate = data[currentIndex + offset];
        if (candidate && candidate.DETALLE === detailType) {
          return candidate[userDataColumn];
        }
      }

      return undefined;
    };

    for (let i = 0; i < data.length; i++) {
      const row = data[i];

      if (
        !row ||
        row[userDataColumn] === "" ||
        row[userDataColumn] === undefined
      ) {
        continue;
      }

      if (row.DETALLE === "SERVICIO") {
        const serviceValue = row[userDataColumn];
        const gainValue = findDetailValue(i, "GANANCIA");
        const clientValue = findDetailValue(i, "CLIENTE");
        const timeValue = findDetailValue(i, "HORA");

        const numericGain = Number(gainValue) || 0;
        totalGanancia += numericGain;

        userRows.push({
          Servicio: String(serviceValue ?? ""),
          Ganancia: numericGain,
          Cliente: clientValue ? String(clientValue) : "",
          Hora: timeValue ? String(timeValue) : "",
        });
      }
    }

    if (userRows.length > 0) {
      const userShare = Number((totalGanancia * 0.5).toFixed(2));

      userRows.push({
        Servicio: `Total ${userDataColumn} (50%)`,
        Ganancia: userShare,
        Cliente: "",
        Hora: "",
      });
    }

    return userRows;
  }

  // Default fallback
  return data;
};

/**
 * Calculate user totals and profit splits
 */
export const calculateUserTotals = (data: ExcelRow[]) => {
  const totals: Record<
    string,
    { total: number; adminShare: number; userShare: number }
  > = {};

  // Initialize totals
  USER_COLUMNS.forEach((user) => {
    totals[user] = {
      total: 0,
      adminShare: 0,
      userShare: 0,
    };
  });

  // Find total rows
  const totalRow = data.find((row) => row.DETALLE === "TOTAL");

  if (totalRow) {
    USER_COLUMNS.forEach((user) => {
      const total = Number(totalRow[user]) || 0;
      totals[user] = {
        total,
        adminShare: total * 0.5, // 50% for admin
        userShare: total * 0.5, // 50% for user
      };
    });
  } else {
    // If no total row, calculate from individual entries
    data.forEach((row) => {
      if (row.DETALLE === "GANANCIA") {
        USER_COLUMNS.forEach((user) => {
          const value = Number(row[user]) || 0;
          totals[user].total += value;
        });
      }
    });

    // Calculate shares
    USER_COLUMNS.forEach((user) => {
      totals[user].adminShare = totals[user].total * 0.5;
      totals[user].userShare = totals[user].total * 0.5;
    });
  }

  return totals;
};

/**
 * Calculate admin's total earnings from all users
 */
export const calculateAdminTotal = (
  userTotals: Record<
    string,
    { total: number; adminShare: number; userShare: number }
  >,
) => {
  let adminTotal = 0;

  Object.values(userTotals).forEach((userTotal) => {
    adminTotal += userTotal.adminShare;
  });

  return adminTotal;
};

/**
 * Add a new service and earnings to the data
 */
export const addServiceAndEarnings = (
  data: ExcelRow[],
  user: string,
  service: string,
  earnings: number,
): ExcelRow[] => {
  // Create a copy of the data
  const newData = [...data];

  // Create new rows for the service and earnings
  const serviceRow: ExcelRow = {
    HENGI: "",
    MARLENI: "",
    ISRAEL: "",
    THAICAR: "",
    DETALLE: "SERVICIO",
  };
  serviceRow[user] = service;

  const earningsRow: ExcelRow = {
    HENGI: "",
    MARLENI: "",
    ISRAEL: "",
    THAICAR: "",
    DETALLE: "GANANCIA",
  };
  earningsRow[user] = earnings;

  // Find the last service/earnings pair
  let insertIndex = newData.length - 3; // Default to before TOTAL and % rows
  for (let i = newData.length - 1; i >= 0; i--) {
    if (
      newData[i].DETALLE === "SERVICIO" ||
      newData[i].DETALLE === "GANANCIA"
    ) {
      insertIndex = i + 1;
      break;
    }
  }

  // Insert the new rows
  newData.splice(insertIndex, 0, earningsRow, serviceRow);

  // Update totals
  const totalRow = newData.find((row) => row.DETALLE === "TOTAL");
  const percentRow = newData.find((row) => row.DETALLE === "%");

  if (totalRow) {
    const currentTotal = Number(totalRow[user]) || 0;
    totalRow[user] = currentTotal + earnings;

    if (percentRow) {
      // Update the percentage row if needed (keeping it at 50%)
      percentRow[user] = "50.%";
    }
  }

  return newData;
};

/**
 * Get sample data for development
 */
export const getSampleData = (): ExcelRow[] => {
  return [
    {
      DETALLE: "GANANCIA",
      HENGI: 120,
      MARLENI: 90,
      ISRAEL: 150,
      THAICAR: 100,
    },
    {
      DETALLE: "CLIENTE",
      HENGI: "Carlos Ruiz",
      MARLENI: "Ana Paredes",
      ISRAEL: "Luis Perdomo",
      THAICAR: "Verónica Diaz",
    },
    {
      DETALLE: "HORA",
      HENGI: "09:15",
      MARLENI: "10:05",
      ISRAEL: "09:45",
      THAICAR: "08:30",
    },
    {
      DETALLE: "SERVICIO",
      HENGI: "Impresión certificada",
      MARLENI: "Digitalización avanzada",
      ISRAEL: "Asesoría fiscal",
      THAICAR: "Entrega de documentación",
    },
    {
      DETALLE: "GANANCIA",
      HENGI: 200,
      MARLENI: 150,
      ISRAEL: 220,
      THAICAR: 160,
    },
    {
      DETALLE: "CLIENTE",
      HENGI: "María Gómez",
      MARLENI: "Javier Tejada",
      ISRAEL: "Empresa Atlántida",
      THAICAR: "Samuel Ortiz",
    },
    {
      DETALLE: "HORA",
      HENGI: "11:20",
      MARLENI: "13:10",
      ISRAEL: "12:40",
      THAICAR: "14:05",
    },
    {
      DETALLE: "SERVICIO",
      HENGI: "Traducción jurada",
      MARLENI: "Gestión de firma digital",
      ISRAEL: "Regularización mercantil",
      THAICAR: "Recolección de impuestos",
    },
    {
      DETALLE: "GANANCIA",
      HENGI: 180,
      MARLENI: 210,
      ISRAEL: 260,
      THAICAR: 190,
    },
    {
      DETALLE: "CLIENTE",
      HENGI: "Gerardo Lora",
      MARLENI: "Studio Creativo Z",
      ISRAEL: "Clínica Nova",
      THAICAR: "Logística Caribe",
    },
    {
      DETALLE: "HORA",
      HENGI: "15:25",
      MARLENI: "17:40",
      ISRAEL: "16:15",
      THAICAR: "18:00",
    },
    {
      DETALLE: "SERVICIO",
      HENGI: "Revisión de contratos",
      MARLENI: "Automatización de formularios",
      ISRAEL: "Auditoría de cumplimiento",
      THAICAR: "Mensajería express premium",
    },
    {
      DETALLE: "TOTAL",
      HENGI: 500,
      MARLENI: 450,
      ISRAEL: 630,
      THAICAR: 450,
    },
    {
      DETALLE: "%",
      HENGI: "50.%",
      MARLENI: "50.%",
      ISRAEL: "50.%",
      THAICAR: "50.%",
    },
  ];
};
