import * as React from 'react'

import type { McpServerFormValues, McpTransportType } from '@/lib/ai'
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

interface McpServerFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  values: McpServerFormValues
  onValuesChange: React.Dispatch<React.SetStateAction<McpServerFormValues>>
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  error: string | null
  mutating: boolean
}

export function McpServerFormDialog({
  open,
  onOpenChange,
  mode,
  values,
  onValuesChange,
  onSubmit,
  error,
  mutating,
}: McpServerFormDialogProps) {
  const isStdio = values.transportType === 'stdio'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={onSubmit}>
          <DialogHeader>
            <DialogTitle>
              {mode === 'create' ? 'Add MCP server' : 'Edit MCP server'}
            </DialogTitle>
            <DialogDescription>
              Connect an external MCP server to provide tools for the AI
              assistant.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[70vh] overflow-y-auto py-4">
            <FieldGroup className="gap-4">
              <Field>
                <FieldLabel htmlFor="mcp-server-name">Server name</FieldLabel>
                <FieldContent>
                  <Input
                    id="mcp-server-name"
                    value={values.name}
                    onChange={(event) =>
                      onValuesChange((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                    placeholder="My Database Server"
                    aria-invalid={Boolean(error && !values.name.trim())}
                  />
                  <FieldDescription>
                    A short label identifying this server. Used as a namespace
                    prefix for its tools.
                  </FieldDescription>
                </FieldContent>
              </Field>

              <Field>
                <FieldLabel htmlFor="mcp-transport-type">
                  Transport type
                </FieldLabel>
                <FieldContent>
                  <Select
                    value={values.transportType}
                    onValueChange={(value: McpTransportType) =>
                      onValuesChange((current) => ({
                        ...current,
                        transportType: value,
                      }))
                    }
                  >
                    <SelectTrigger id="mcp-transport-type" className="w-full">
                      <SelectValue placeholder="Select transport type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectItem value="stdio">Standard I/O</SelectItem>
                        <SelectItem value="sse">SSE</SelectItem>
                        <SelectItem value="streamable_http">
                          Streamable HTTP
                        </SelectItem>
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {isStdio
                      ? 'Launches a local process and communicates via stdin/stdout.'
                      : 'Connects to a remote MCP server over HTTP.'}
                  </FieldDescription>
                </FieldContent>
              </Field>

              {isStdio ? (
                <>
                  <Field>
                    <FieldLabel htmlFor="mcp-command">Command</FieldLabel>
                    <FieldContent>
                      <Input
                        id="mcp-command"
                        value={values.command}
                        onChange={(event) =>
                          onValuesChange((current) => ({
                            ...current,
                            command: event.target.value,
                          }))
                        }
                        placeholder="npx"
                      />
                      <FieldDescription>
                        The executable to launch (e.g. node, npx, python, uvx,
                        docker).
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="mcp-args">
                      Arguments
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="mcp-args"
                        value={values.args}
                        onChange={(event) =>
                          onValuesChange((current) => ({
                            ...current,
                            args: event.target.value,
                          }))
                        }
                        placeholder={'-y\n@modelcontextprotocol/server-sqlite\n/path/to/db.sqlite'}
                        rows={3}
                        className="font-mono text-xs"
                      />
                      <FieldDescription>
                        One argument per line, or JSON array format.
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="mcp-env">
                      Environment variables
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="mcp-env"
                        value={values.env}
                        onChange={(event) =>
                          onValuesChange((current) => ({
                            ...current,
                            env: event.target.value,
                          }))
                        }
                        placeholder={'DATABASE_URL=postgres://...\nAPI_KEY=sk-...'}
                        rows={3}
                        className="font-mono text-xs"
                      />
                      <FieldDescription>
                        KEY=VALUE per line, or JSON object format. These are
                        merged with the server environment.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </>
              ) : (
                <>
                  <Field>
                    <FieldLabel htmlFor="mcp-url">Server URL</FieldLabel>
                    <FieldContent>
                      <Input
                        id="mcp-url"
                        value={values.url}
                        onChange={(event) =>
                          onValuesChange((current) => ({
                            ...current,
                            url: event.target.value,
                          }))
                        }
                        placeholder="https://mcp.example.com/sse"
                      />
                      <FieldDescription>
                        The full URL of the MCP server endpoint.
                      </FieldDescription>
                    </FieldContent>
                  </Field>

                  <Field>
                    <FieldLabel htmlFor="mcp-headers">
                      Custom headers
                    </FieldLabel>
                    <FieldContent>
                      <Textarea
                        id="mcp-headers"
                        value={values.headers}
                        onChange={(event) =>
                          onValuesChange((current) => ({
                            ...current,
                            headers: event.target.value,
                          }))
                        }
                        placeholder={'Authorization=Bearer sk-...\nX-Custom-Header=value'}
                        rows={3}
                        className="font-mono text-xs"
                      />
                      <FieldDescription>
                        KEY=VALUE per line, or JSON object format. Used for
                        authentication and custom request headers.
                      </FieldDescription>
                    </FieldContent>
                  </Field>
                </>
              )}

              <Field>
                <FieldLabel htmlFor="mcp-server-enabled">
                  Enable server
                </FieldLabel>
                <FieldContent>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-3 py-3">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        Server availability
                      </p>
                      <p className="text-xs leading-5 text-muted-foreground">
                        Disabled servers stay saved but their tools are not
                        exposed to the AI assistant.
                      </p>
                    </div>
                    <Switch
                      id="mcp-server-enabled"
                      checked={values.enabled}
                      onCheckedChange={(checked) =>
                        onValuesChange((current) => ({
                          ...current,
                          enabled: checked,
                        }))
                      }
                    />
                  </div>
                </FieldContent>
              </Field>
            </FieldGroup>

            {error ? (
              <p className="mt-4 text-sm text-destructive">{error}</p>
            ) : null}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={mutating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutating}>
              {mutating
                ? mode === 'create'
                  ? 'Adding…'
                  : 'Saving…'
                : mode === 'create'
                  ? 'Add Server'
                  : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
