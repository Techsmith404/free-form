import React from 'react';
import { FormFieldTableColumn } from '../../types/index.js';
import { Plus, Trash2, Table as TableIcon } from 'lucide-react';

interface DynamicTableFieldProps {
  label: string;
  columns?: FormFieldTableColumn[];
  rows: Array<Record<string, any>>;
  onChange: (rows: Array<Record<string, any>>) => void;
  description?: string;
}

export const DynamicTableField: React.FC<DynamicTableFieldProps> = ({
  label,
  columns = [],
  rows = [],
  onChange,
  description
}) => {
  const handleAddRow = () => {
    const newRow: Record<string, any> = {};
    columns.forEach((col) => {
      newRow[col.id] = col.type === 'checkbox' ? false : '';
    });
    onChange([...rows, newRow]);
  };

  const handleRemoveRow = (index: number) => {
    const updated = rows.filter((_, idx) => idx !== index);
    onChange(updated);
  };

  const handleCellChange = (rowIndex: number, colId: string, val: any) => {
    const updated = [...rows];
    updated[rowIndex] = {
      ...updated[rowIndex],
      [colId]: val
    };
    onChange(updated);
  };

  if (columns.length === 0) {
    return (
      <div className="text-xs text-zinc-500 italic p-3 border border-zinc-800 rounded-lg">
        Table {label} has no columns configured
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <label className="text-xs font-medium text-zinc-300 flex items-center gap-1.5">
            <TableIcon className="w-3.5 h-3.5 text-brand-400" />
            <span>{label}</span>
          </label>
          {description && (
            <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleAddRow}
          className="flex items-center gap-1 text-xs px-2.5 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-lg transition font-medium"
        >
          <Plus className="w-3.5 h-3.5 text-brand-400" />
          <span>Add Row</span>
        </button>
      </div>

      <div className="border border-zinc-800 rounded-xl overflow-x-auto bg-zinc-950/60">
        <table className="w-full text-xs text-left">
          <thead className="bg-zinc-900/80 text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="py-2 px-3 w-8 text-center">#</th>
              {columns.map((col) => (
                <th key={col.id} className="py-2 px-3 font-medium">
                  {col.name}
                </th>
              ))}
              <th className="py-2 px-2 w-10 text-center"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + 2}
                  className="py-4 text-center text-zinc-500 italic"
                >
                  No entries added yet. Click &quot;Add Row&quot; to begin.
                </td>
              </tr>
            ) : (
              rows.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-zinc-900/30 transition">
                  <td className="py-2 px-2 text-center text-zinc-500 font-mono text-[10px]">
                    {rIdx + 1}
                  </td>
                  {columns.map((col) => (
                    <td key={col.id} className="py-1.5 px-2">
                      {col.type === 'checkbox' ? (
                        <input
                          type="checkbox"
                          checked={Boolean(row[col.id])}
                          onChange={(e) => handleCellChange(rIdx, col.id, e.target.checked)}
                          className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-brand-500 focus:ring-brand-500 focus:ring-offset-zinc-950"
                        />
                      ) : col.type === 'number' ? (
                        <input
                          type="number"
                          value={row[col.id] ?? ''}
                          onChange={(e) => handleCellChange(rIdx, col.id, e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                        />
                      ) : col.type === 'date' ? (
                        <input
                          type="date"
                          value={row[col.id] ?? ''}
                          onChange={(e) => handleCellChange(rIdx, col.id, e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                        />
                      ) : (
                        <input
                          type="text"
                          value={row[col.id] ?? ''}
                          onChange={(e) => handleCellChange(rIdx, col.id, e.target.value)}
                          className="w-full px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-xs text-zinc-100 focus:outline-none focus:border-brand-500"
                        />
                      )}
                    </td>
                  ))}
                  <td className="py-1 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveRow(rIdx)}
                      className="p-1 rounded text-zinc-500 hover:text-red-400 transition"
                      title="Remove Row"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
