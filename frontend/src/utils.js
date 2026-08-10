import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";

dayjs.extend(utc);
dayjs.extend(timezone);

const DISPLAY_TIME_ZONE = "Asia/Singapore";

const headerFilename = (header) => {
  const match = header?.match(/filename\*?=(?:UTF-8''|["']?)([^"';]+)/i);
  return match ? decodeURIComponent(match[1].replace(/["']/g, "")) : null;
};

export const saveBlobResponse = (response, fallbackName) => {
  const filename = headerFilename(response.headers["content-disposition"]) || fallbackName;
  const url = URL.createObjectURL(response.data);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return filename;
};

export const getErrorMessage = (error, fallback = "Something went wrong. Please try again.") => {
  if (!error.response) return error.request ? "Cannot reach the payroll server. Please check that it is running." : fallback;
  return error.response.data?.message || fallback;
};

export const getErrorCode = (error) => error.response?.data?.error || "UNKNOWN_ERROR";
export const getErrorDetails = (error) => Array.isArray(error.response?.data?.details) ? error.response.data.details : [];

export const formatCurrency = (value) => new Intl.NumberFormat("en-SG", { style: "currency", currency: "SGD" }).format(Number(value || 0));
export const formatDate = (value) => value && dayjs(value).isValid() ? dayjs(value).format("D MMM YYYY") : "Not available";
export const formatDateTime = (value) => value && dayjs(value).isValid() ? dayjs(value).tz(DISPLAY_TIME_ZONE).format("D MMM YYYY, h:mm A") : "Not available";
export const formatPeriod = (start, end) => `${formatDate(start)} - ${formatDate(end)}`;
export const formatStatus = (value) => value ? value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Unknown";

const defaultPeriodStart = (period) =>
  period?.startDate ?? period?.start_date ?? period?.periodStart ?? period?.payPeriodStart;

export const sortByTimestampsNewestFirst = (items = [], ...getTimestamps) =>
  [...items]
    .map((item, index) => {
      const timestamps = getTimestamps.map((getTimestamp) => {
        const value = getTimestamp(item);
        return value && dayjs(value).isValid() ? dayjs(value).valueOf() : null;
      });
      return { item, index, timestamps };
    })
    .sort((a, b) => {
      for (let key = 0; key < getTimestamps.length; key += 1) {
        const aTimestamp = a.timestamps[key];
        const bTimestamp = b.timestamps[key];
        if (aTimestamp === null && bTimestamp === null) continue;
        if (aTimestamp === null) return 1;
        if (bTimestamp === null) return -1;
        if (aTimestamp !== bTimestamp) return bTimestamp - aTimestamp;
      }
      return a.index - b.index;
    })
    .map(({ item }) => item);

export const sortPayPeriodsNewestFirst = (periods = [], getStartDate = defaultPeriodStart) =>
  sortByTimestampsNewestFirst(periods, getStartDate);
