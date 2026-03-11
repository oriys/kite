'use client'

import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'

import {
  createDefaultHeatmapDocument,
  normalizeHeatmapDocument,
  type HeatmapDocument,
} from '@/lib/heatmap'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'

interface DocHeatmapEditorDialogProps {
  open: boolean
  data: HeatmapDocument | null
  onOpenChange: (open: boolean) => void
  onSave: (data: HeatmapDocument) => void
}

function createRowLabel(index: number) {
  return `Row ${index + 1}`
}

function createColumnLabel(index: number) {
  return `Column ${index + 1}`
}

export function DocHeatmapEditorDialog({
  open,
  data,
  onOpenChange,
  onSave,
}: DocHeatmapEditorDialogProps) {
  const [draft, setDraft] = React.useState<HeatmapDocument>(() =>
    normalizeHeatmapDocument(data ?? createDefaultHeatmapDocument()),
  )

  React.useEffect(() => {
    if (!open) {
      return
    }

    setDraft(normalizeHeatmapDocument(data ?? createDefaultHeatmapDocument()))
  }, [data, open])

  const handleColumnLabelChange = React.useCallback((index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column, columnIndex) =>
        columnIndex === index ? value : column,
      ),
    }))
  }, [])

  const handleRowLabelChange = React.useCallback((index: number, value: string) => {
    setDraft((current) => ({
      ...current,
      rows: current.rows.map((row, rowIndex) =>
        rowIndex === index ? { ...row, label: value } : row,
      ),
    }))
  }, [])

  const handleCellValueChange = React.useCallback(
    (rowIndex: number, columnIndex: number, value: string) => {
      setDraft((current) => ({
        ...current,
        rows: current.rows.map((row, currentRowIndex) => {
          if (currentRowIndex !== rowIndex) {
            return row
          }

          const nextValues = row.values.map((cellValue, currentColumnIndex) => {
            if (currentColumnIndex !== columnIndex) {
              return cellValue
            }

            const numericValue = value.trim() === '' ? 0 : Number(value)

            if (!Number.isFinite(numericValue)) {
              return cellValue
            }

            return Math.max(0, Math.min(100, Math.round(numericValue)))
          })

          return {
            ...row,
            values: nextValues,
          }
        }),
      }))
    },
    [],
  )

  const handleAddColumn = React.useCallback(() => {
    setDraft((current) => ({
      ...current,
      columns: [...current.columns, createColumnLabel(current.columns.length)],
      rows: current.rows.map((row) => ({
        ...row,
        values: [...row.values, 0],
      })),
    }))
  }, [])

  const handleRemoveColumn = React.useCallback((index: number) => {
    setDraft((current) => {
      if (current.columns.length <= 1) {
        return current
      }

      return {
        ...current,
        columns: current.columns.filter((_, columnIndex) => columnIndex !== index),
        rows: current.rows.map((row) => ({
          ...row,
          values: row.values.filter((_, columnIndex) => columnIndex !== index),
        })),
      }
    })
  }, [])

  const handleAddRow = React.useCallback(() => {
    setDraft((current) => ({
      ...current,
      rows: [
        ...current.rows,
        {
          label: createRowLabel(current.rows.length),
          values: current.columns.map(() => 0),
        },
      ],
    }))
  }, [])

  const handleRemoveRow = React.useCallback((index: number) => {
    setDraft((current) => {
      if (current.rows.length <= 1) {
        return current
      }

      return {
        ...current,
        rows: current.rows.filter((_, rowIndex) => rowIndex !== index),
      }
    })
  }, [])

  const handleSave = React.useCallback(() => {
    onSave(normalizeHeatmapDocument(draft))
  }, [draft, onSave])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(86vh,860px)] overflow-hidden p-0 sm:max-w-5xl">
        <DialogHeader className="gap-3 border-b border-border/70 px-6 py-5">
          <DialogTitle>Edit Heatmap</DialogTitle>
          <DialogDescription>
            Edit labels, grid values, and legend copy. Cell values use a 0 to 100 scale.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto px-6 py-5">
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor="heatmap-title">Title</FieldLabel>
              <FieldContent>
                <Input
                  id="heatmap-title"
                  value={draft.title}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="heatmap-description">Description</FieldLabel>
              <FieldContent>
                <Textarea
                  id="heatmap-description"
                  value={draft.description}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  className="min-h-24"
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="heatmap-min-label">Low-end Label</FieldLabel>
              <FieldContent>
                <Input
                  id="heatmap-min-label"
                  value={draft.minLabel}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      minLabel: event.target.value,
                    }))
                  }
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel htmlFor="heatmap-max-label">High-end Label</FieldLabel>
              <FieldContent>
                <Input
                  id="heatmap-max-label"
                  value={draft.maxLabel}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      maxLabel: event.target.value,
                    }))
                  }
                />
              </FieldContent>
            </Field>

            <Field>
              <FieldLabel>Matrix</FieldLabel>
              <FieldContent>
                <FieldDescription>
                  Rows usually represent teams or categories. Columns work well for time
                  slices, stages, or environments.
                </FieldDescription>

                <div className="flex flex-wrap items-center justify-end gap-2 rounded-lg border border-border/70 bg-muted/20 px-3 py-3">
                  <Button variant="outline" size="sm" type="button" onClick={handleAddColumn}>
                    <Plus data-icon="inline-start" />
                    Add Column
                  </Button>
                  <Button variant="outline" size="sm" type="button" onClick={handleAddRow}>
                    <Plus data-icon="inline-start" />
                    Add Row
                  </Button>
                </div>

                <div className="overflow-x-auto rounded-lg border border-border/75">
                  <table className="min-w-[48rem] border-collapse text-sm">
                    <thead>
                      <tr>
                        <th className="w-48 border border-border/75 bg-muted/35 px-3 py-2 text-left font-medium">
                          Row / Column
                        </th>
                        {draft.columns.map((column, columnIndex) => (
                          <th
                            key={`column-${columnIndex}`}
                            className="min-w-32 border border-border/75 bg-muted/35 px-2 py-2 align-top"
                          >
                            <div className="flex flex-col gap-2">
                              <Input
                                value={column}
                                onChange={(event) =>
                                  handleColumnLabelChange(columnIndex, event.target.value)
                                }
                                aria-label={`Column ${columnIndex + 1} label`}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                disabled={draft.columns.length <= 1}
                                onClick={() => handleRemoveColumn(columnIndex)}
                              >
                                <Trash2 data-icon="inline-start" />
                                Remove
                              </Button>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {draft.rows.map((row, rowIndex) => (
                        <tr key={`row-${rowIndex}`}>
                          <td className="border border-border/75 bg-card/70 px-2 py-2 align-top">
                            <div className="flex flex-col gap-2">
                              <Input
                                value={row.label}
                                onChange={(event) =>
                                  handleRowLabelChange(rowIndex, event.target.value)
                                }
                                aria-label={`Row ${rowIndex + 1} label`}
                              />
                              <Button
                                variant="ghost"
                                size="sm"
                                type="button"
                                disabled={draft.rows.length <= 1}
                                onClick={() => handleRemoveRow(rowIndex)}
                              >
                                <Trash2 data-icon="inline-start" />
                                Remove
                              </Button>
                            </div>
                          </td>

                          {row.values.map((value, columnIndex) => (
                            <td
                              key={`cell-${rowIndex}-${columnIndex}`}
                              className="border border-border/75 bg-background/70 px-2 py-2"
                            >
                              <Input
                                type="number"
                                min={0}
                                max={100}
                                value={String(value)}
                                onChange={(event) =>
                                  handleCellValueChange(
                                    rowIndex,
                                    columnIndex,
                                    event.target.value,
                                  )
                                }
                                aria-label={`${row.label || createRowLabel(rowIndex)}, ${draft.columns[columnIndex] || createColumnLabel(columnIndex)}`}
                              />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </FieldContent>
            </Field>
          </FieldGroup>
        </div>

        <DialogFooter className="border-t border-border/70 px-6 py-4">
          <Button variant="outline" type="button" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={handleSave}>
            Save Heatmap
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
