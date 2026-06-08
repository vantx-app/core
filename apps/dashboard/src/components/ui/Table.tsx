"use client";

import { TableColumn, TableProps } from "@/types";
import React, { useState } from "react";

export function Table<T>({
  columns,
  data,
  keyExtractor,
  className = "table w-full",
  wrapperClassName = "overflow-x-auto rounded-2xl border border-base-200 bg-base-100/50 backdrop-blur-md shadow-sm",
  tbodyClassName = "",
  rowClassName = "hover",
  emptyState,
  isLoading = false,
  pagination = false,
  pageSize = 10,
}: TableProps<T>) {
  const [currentPage, setCurrentPage] = useState(1);

  const itemsPerPage = pageSize;
  const totalPages = Math.ceil(data.length / itemsPerPage);

  // Reset page if data length changes and current page is out of bounds
  React.useEffect(() => {
    if (pagination && currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    }
  }, [data.length, totalPages, pagination, currentPage]);

  const displayedData = pagination
    ? data.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
    : data;

  const startRecord = (currentPage - 1) * itemsPerPage + 1;
  const endRecord = Math.min(data.length, currentPage * itemsPerPage);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  return (
    <div className={wrapperClassName}>
      <table className={className}>
        <thead>
          <tr className="bg-base-200/50 text-base-content/75 border-b border-base-200">
            {columns.map((col) => (
              <th key={col.key} className={col.headerClassName}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className={tbodyClassName}>
          {isLoading ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8">
                <div className="flex justify-center items-center gap-2">
                  <span className="loading loading-spinner loading-md text-primary"></span>
                  <span className="text-sm text-base-content/60">
                    Cargando...
                  </span>
                </div>
              </td>
            </tr>
          ) : displayedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="text-center py-8">
                {emptyState || (
                  <span className="text-sm text-base-content/40 italic">
                    No hay registros disponibles.
                  </span>
                )}
              </td>
            </tr>
          ) : (
            displayedData.map((row, index) => {
              // Adjust local index to global index for render callbacks
              const globalIndex = pagination
                ? (currentPage - 1) * itemsPerPage + index
                : index;
              const rClass =
                typeof rowClassName === "function"
                  ? rowClassName(row, globalIndex)
                  : rowClassName;
              return (
                <tr key={keyExtractor(row, globalIndex)} className={rClass}>
                  {columns.map((col) => {
                    const content = col.render
                      ? col.render(row, globalIndex)
                      : ((row as Record<string, unknown>)[
                          col.key
                        ] as React.ReactNode);
                    return (
                      <td key={col.key} className={col.className}>
                        {content}
                      </td>
                    );
                  })}
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      {/* Pagination Footer */}
      {pagination && data.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 border-t border-base-200 bg-base-100/30 backdrop-blur-sm">
          <div className="text-xs text-base-content/60">
            Mostrando{" "}
            <span className="font-bold text-base-content">{startRecord}</span> a{" "}
            <span className="font-bold text-base-content">{endRecord}</span> de{" "}
            <span className="font-bold text-base-content">{data.length}</span>{" "}
            registros
          </div>
          {totalPages > 1 && (
            <div className="join shadow-sm border border-base-200">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => handlePageChange(currentPage - 1)}
                className="join-item btn btn-xs min-h-[2rem] h-8 bg-base-100 hover:bg-base-200 text-base-content border-none"
              >
                Anterior
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page === 1 ||
                    page === totalPages ||
                    Math.abs(page - currentPage) <= 1,
                )
                .map((page, index, array) => {
                  const showEllipsis = index > 0 && page - array[index - 1] > 1;
                  return (
                    <React.Fragment key={page}>
                      {showEllipsis && (
                        <span className="join-item btn btn-xs min-h-[2rem] h-8 btn-disabled bg-base-100 text-base-content/40 cursor-default border-none">
                          ...
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => handlePageChange(page)}
                        className={`join-item btn btn-xs min-h-[2rem] h-8 border-none ${
                          currentPage === page
                            ? "btn-primary text-white font-bold"
                            : "bg-base-100 hover:bg-base-200 text-base-content"
                        }`}
                      >
                        {page}
                      </button>
                    </React.Fragment>
                  );
                })}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => handlePageChange(currentPage + 1)}
                className="join-item btn btn-xs min-h-[2rem] h-8 bg-base-100 hover:bg-base-200 text-base-content border-none"
              >
                Siguiente
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
