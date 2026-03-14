import type { Metadata } from 'next'

import {
  AlertCircle,
  ArrowUpRight,
  BookOpenText,
  Bot,
  Braces,
  Clock3,
  Command,
  Database,
  FileText,
  FileJson,
  GitBranch,
  LayoutGrid,
  Library,
  MessageSquareQuote,
  PenSquare,
  Route,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  WandSparkles,
  Webhook,
} from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  ApiCodeTabs,
  ApiEndpointCard,
  ApiEndpointHeader,
  ApiEndpointMeta,
  ApiEndpointMetaItem,
  ApiEndpointPath,
  ApiResponseBadge,
  GraphqlField,
  GraphqlFieldList,
  GraphqlOperationCard,
  WebhookDeliveryItem,
  WebhookDeliveryList,
  WebhookEventCard,
} from '@/components/ui/api-docs'
import { BackToTop } from '@/components/ui/back-to-top'
import { Callout } from '@/components/ui/callout'
import { CodeBlock } from '@/components/ui/code-block'
import { FileTree } from '@/components/ui/file-tree'
import { Feedback } from '@/components/ui/feedback'
import { JsonViewer } from '@/components/ui/json-viewer'
import { Steps, Step } from '@/components/ui/steps'
import { ZoomImage } from '@/components/ui/zoom-image'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Button } from '@/components/ui/button'
import { ButtonGroup } from '@/components/ui/button-group'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import {
  HttpMethodBadge,
  HttpRequest,
  HttpRequestBar,
  HttpRequestBody,
  HttpRequestItem,
  HttpRequestItems,
  HttpRequestSection,
  HttpRequestUrl,
} from '@/components/ui/http-request'
import { Input } from '@/components/ui/input'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from '@/components/ui/input-group'
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemSeparator,
  ItemTitle,
} from '@/components/ui/item'
import { Kbd, KbdGroup } from '@/components/ui/kbd'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { StatusBadge } from '@/components/ui/status-badge'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'

import { ApiPlayground } from '@/components/api-playground'
import { MobileNav } from '@/components/mobile-nav'
import { SearchCommand } from '@/components/search-command'
import { SearchTrigger } from '@/components/search-trigger'
import { SidebarNav } from '@/components/sidebar-nav'
import { SkipLink } from '@/components/skip-link'
import { ThemeToggle } from '@/components/theme-toggle'

import {
  sections,
  metrics,
  tonePrinciples,
  colorTokenGroups,
  typeScale,
  navigationPatterns,
  requestQueryRows,
  requestHeaderRows,
  requestBodyExample,
  requestComponentTiles,
  restEndpointMeta,
  restResponseStates,
  restCodeSamples,
  webhookEvents,
  webhookDeliveryRows,
  webhookPayloadExample,
  graphqlOperationSamples,
  graphqlSchemaTypes,
  databaseRows,
  documentRows,
} from './_data'
import {
  reveal,
  SectionHeading,
  MetricTile,
  TokenGroupSection,
  FeatureTile,
} from './_components'

export const metadata: Metadata = {
  title: 'Components — Editorial System',
  description: 'Component showcase for the editorial system UI library.',
}

export default function Page() {
  return (
    <div className="min-h-[100dvh]">
      <SkipLink />
      <SearchCommand sections={sections} />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <header className="editorial-surface editorial-reveal mb-6 px-5 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <MobileNav sections={sections} />
              <div className="flex size-11 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[0_1px_2px_rgba(15,23,42,0.18)]">
                <BookOpenText className="size-5" />
              </div>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">
                    Editorial System
                  </p>
                  <Badge variant="outline">knowledge ui</Badge>
                </div>
                <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
                  A product-facing system for docs, editors, internal tools, and
                  database surfaces.
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <SearchTrigger />
              <ThemeToggle />
              <Button variant="outline">
                Preview docs
                <ArrowUpRight className="size-4" />
              </Button>
            </div>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[248px_minmax(0,1fr)]">
          <SidebarNav sections={sections} />

          <main id="main-content" className="space-y-14 pb-12">
            <section
              id="overview"
              className="grid gap-6 lg:grid-cols-[minmax(0,1.08fr)_minmax(340px,0.92fr)]"
            >
              <div
                className="editorial-surface editorial-reveal px-6 py-8 sm:px-8"
                style={reveal(60)}
              >
                <Badge variant="outline">editorial foundations</Badge>
                <h1 className="mt-4 text-4xl tracking-tight md:text-6xl md:leading-none">
                  Calm structure for product docs, knowledge hubs, and internal tools.
                </h1>
                <p className="mt-5 max-w-[64ch] text-base leading-8 text-muted-foreground">
                  This pass turns the component set into a coherent system: warm
                  paper surfaces, compact controls, soft borders, and documentation
                  rhythms that still hold up inside dense application shells.
                </p>

                <div className="mt-7 flex flex-wrap gap-3">
                  <Button asChild>
                    <a href="#foundations">Browse foundations</a>
                  </Button>
                  <Button variant="outline" asChild>
                    <a href="#controls">Inspect controls</a>
                  </Button>
                </div>

                <div className="mt-8 grid gap-3 sm:grid-cols-3">
                  {metrics.map((metric) => (
                    <MetricTile key={metric.label} {...metric} />
                  ))}
                </div>
              </div>

              <Card className="editorial-reveal" style={reveal(120)}>
                <CardHeader>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <CardTitle>System preview</CardTitle>
                      <CardDescription>
                        A single language for writing, planning, and database views.
                      </CardDescription>
                    </div>
                    <Badge variant="secondary">v1 foundations</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-border/75 bg-background/80 p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                      <PenSquare className="size-4 text-muted-foreground" />
                      Editor surface
                    </div>
                    <div className="mt-4 space-y-3">
                      <div className="h-3 w-28 rounded-full bg-muted" />
                      <div className="h-3 w-full rounded-full bg-muted" />
                      <div className="h-3 w-[92%] rounded-full bg-muted" />
                      <div className="editorial-callout mt-5">
                        <p className="text-sm leading-6 text-muted-foreground">
                          Callouts, code, page metadata, and inline actions sit on
                          the same visual rhythm.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="editorial-panel p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Sparkles className="size-4 text-muted-foreground" />
                        Capture
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Small action surfaces stay readable without turning into
                        glossy dashboard cards.
                      </p>
                    </div>
                    <div className="editorial-panel p-3">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <Database className="size-4 text-muted-foreground" />
                        Organize
                      </div>
                      <p className="mt-2 text-sm leading-6 text-muted-foreground">
                        Dense lists rely on spacing, alignment, and state chips
                        instead of heavy chrome.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </section>

            <section
              id="foundations"
              className="space-y-5 editorial-reveal"
              style={reveal(180)}
            >
              <SectionHeading
                eyebrow="Foundations"
                title="Color, type, and spacing stay understated by default."
                description="The system leans on paper-like contrast instead of dramatic gradients. Type stays tight and editorial, while spacing does the heavy lifting between dense content groups."
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Color tokens</CardTitle>
                    <CardDescription>
                      Expanded foundations across surfaces, actions, semantics, and data.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    {colorTokenGroups.map((group) => (
                      <TokenGroupSection key={group.title} {...group} />
                    ))}
                  </CardContent>
                </Card>

                <div className="grid gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Type scale</CardTitle>
                      <CardDescription>
                        Tight tracking for headings, relaxed reading rhythm for body copy.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-5">
                      {typeScale.map((item) => (
                        <div key={item.label} className="space-y-2">
                          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                            {item.label}
                          </p>
                          <p className={item.className}>{item.sample}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Design principles</CardTitle>
                      <CardDescription>
                        The tone stays closer to structured writing than polished marketing.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {tonePrinciples.map((principle) => (
                        <div
                          key={principle}
                          className="flex gap-3 rounded-lg border border-border/70 bg-background/80 px-4 py-3"
                        >
                          <div className="mt-1 size-2 rounded-full bg-primary/70" />
                          <p className="text-sm leading-6 text-muted-foreground">
                            {principle}
                          </p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>

            <section
              id="controls"
              className="space-y-5 editorial-reveal"
              style={reveal(240)}
            >
              <SectionHeading
                eyebrow="Controls"
                title="Actions and inputs feel compact, stable, and paper-native."
                description="Primary actions stay dark and quiet. Secondary actions read like soft paper tabs. Inputs avoid glassy shine and keep focus states clear without overwhelming the page."
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Action families</CardTitle>
                    <CardDescription>
                      Buttons, grouped actions, and tab rails for editorial workspaces.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <div className="flex flex-wrap gap-3">
                      <Button>Primary action</Button>
                      <Button variant="outline">Secondary</Button>
                      <Button variant="secondary">Muted surface</Button>
                      <Button variant="ghost">Ghost link</Button>
                    </div>

                    <ButtonGroup>
                      <Button variant="outline">Duplicate</Button>
                      <Button variant="outline">Move</Button>
                      <Button variant="outline">Archive</Button>
                    </ButtonGroup>

                    <Tabs defaultValue="writer" className="gap-3">
                      <TabsList>
                        <TabsTrigger value="writer">Writer</TabsTrigger>
                        <TabsTrigger value="database">Database</TabsTrigger>
                        <TabsTrigger value="ai">AI assist</TabsTrigger>
                      </TabsList>

                      <TabsContent value="writer">
                        <div className="grid gap-3 md:grid-cols-3">
                          <FeatureTile
                            icon={PenSquare}
                            title="Long-form blocks"
                            description="Heading, quote, callout, and code patterns live in the same spacing system."
                          />
                          <FeatureTile
                            icon={BookOpenText}
                            title="Reading mode"
                            description="Surface contrast stays stable across prose, annotations, and embeds."
                          />
                          <FeatureTile
                            icon={Library}
                            title="Reusable sections"
                            description="Layout primitives stay neutral enough to repeat across docs."
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="database">
                        <div className="grid gap-3 md:grid-cols-3">
                          <FeatureTile
                            icon={Database}
                            title="Dense rows"
                            description="Rows use spacing and subtle hover states instead of boxed-in cards."
                          />
                          <FeatureTile
                            icon={LayoutGrid}
                            title="Split layouts"
                            description="Databases pair well with page maps, filters, and detail sidebars."
                          />
                          <FeatureTile
                            icon={Clock3}
                            title="Status rhythm"
                            description="Metadata aligns to a quiet, scannable baseline."
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="ai">
                        <div className="grid gap-3 md:grid-cols-3">
                          <FeatureTile
                            icon={Bot}
                            title="Prompt bars"
                            description="Prompt surfaces should feel embedded, not bolted on."
                          />
                          <FeatureTile
                            icon={WandSparkles}
                            title="Assisted edits"
                            description="Suggested actions remain lightweight until the user commits."
                          />
                          <FeatureTile
                            icon={Sparkles}
                            title="Quiet emphasis"
                            description="Accent color highlights moments of system intelligence."
                          />
                        </div>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Form stack</CardTitle>
                    <CardDescription>
                      Labels sit above inputs, helper copy stays close, and toggles read as configuration instead of decoration.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FieldGroup>
                      <Field>
                        <FieldContent>
                          <FieldLabel htmlFor="workspace-name">
                            Workspace name
                          </FieldLabel>
                          <Input
                            id="workspace-name"
                            placeholder="Personal wiki"
                          />
                          <FieldDescription>
                            Use concise nouns that work well in breadcrumbs and search.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldContent>
                          <FieldLabel htmlFor="workspace-type">
                            Default surface
                          </FieldLabel>
                          <Select defaultValue="docs">
                            <SelectTrigger id="workspace-type" className="w-full">
                              <SelectValue placeholder="Choose a surface" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="docs">Documentation hub</SelectItem>
                              <SelectItem value="notes">Meeting notes</SelectItem>
                              <SelectItem value="db">Database shell</SelectItem>
                            </SelectContent>
                          </Select>
                          <FieldDescription>
                            Keeps layout, navigation, and default empty states aligned.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <Field>
                        <FieldContent>
                          <FieldLabel htmlFor="workspace-intent">
                            Usage notes
                          </FieldLabel>
                          <Textarea
                            id="workspace-intent"
                            placeholder="Capture decisions, specs, and handoff notes without changing the visual tone."
                          />
                        </FieldContent>
                      </Field>

                      <Field orientation="horizontal">
                        <Switch defaultChecked />
                        <FieldContent>
                          <FieldTitle>Compact navigation</FieldTitle>
                          <FieldDescription>
                            Prioritize density in sidebars and table views without increasing visual noise.
                          </FieldDescription>
                        </FieldContent>
                      </Field>

                      <div className="flex flex-wrap gap-3">
                        <Button>Create workspace</Button>
                        <Button variant="outline">Save as template</Button>
                      </div>
                    </FieldGroup>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section
              id="navigation"
              className="space-y-5 editorial-reveal"
              style={reveal(300)}
            >
              <SectionHeading
                eyebrow="Navigation"
                title="Hierarchy stays visible even when the interface gets dense."
                description="Navigation should feel like part of the page, not a layer placed on top of it. Breadcrumbs, command bars, and side links all share the same quiet material language."
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Command and hierarchy</CardTitle>
                    <CardDescription>
                      Search, breadcrumbs, and shortcuts belong to the same system voice.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-5">
                    <Breadcrumb>
                      <BreadcrumbList>
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#">Design</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbLink href="#">Systems</BreadcrumbLink>
                        </BreadcrumbItem>
                        <BreadcrumbSeparator />
                        <BreadcrumbItem>
                          <BreadcrumbPage>Editorial System</BreadcrumbPage>
                        </BreadcrumbItem>
                      </BreadcrumbList>
                    </Breadcrumb>

                    <InputGroup>
                      <InputGroupAddon align="inline-start">
                        <Command className="size-4" />
                      </InputGroupAddon>
                      <InputGroupInput placeholder="Jump to a page, template, or component" />
                      <InputGroupAddon align="inline-end">
                        <KbdGroup>
                          <Kbd>Shift</Kbd>
                          <Kbd>J</Kbd>
                        </KbdGroup>
                      </InputGroupAddon>
                    </InputGroup>

                    <div className="grid gap-3 md:grid-cols-3">
                      {navigationPatterns.map((pattern) => (
                        <FeatureTile
                          key={pattern.title}
                          icon={pattern.icon}
                          title={pattern.title}
                          description={pattern.note}
                        />
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Page map module</CardTitle>
                    <CardDescription>
                      Sticky navigation works best when it reads like a notebook index.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {sections.map((section, index) => (
                      <a
                        key={section.id}
                        href={`#${section.id}`}
                        className="flex items-center justify-between rounded-lg border border-border/70 bg-background/80 px-4 py-3 text-sm transition-colors hover:bg-muted/60"
                      >
                        <div>
                          <p className="font-medium text-foreground">
                            {String(index + 1).padStart(2, '0')}. {section.label}
                          </p>
                          <p className="mt-1 text-muted-foreground">{section.note}</p>
                        </div>
                        <ArrowUpRight className="size-4 text-muted-foreground" />
                      </a>
                    ))}
                  </CardContent>
                </Card>
              </div>
            </section>

            <section
              id="playground"
              className="space-y-5 editorial-reveal"
              style={reveal(300)}
            >
              <SectionHeading
                eyebrow="Interactive"
                title="Try the API directly from your browser."
                description="Explore endpoints, test authentication, and see real responses without leaving the documentation."
              />
              <Card>
                <CardHeader>
                  <CardTitle>API Playground</CardTitle>
                  <CardDescription>
                    Send live requests to any endpoint.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ApiPlayground />
                </CardContent>
              </Card>
            </section>

            <section
              id="requests"
              className="space-y-5 editorial-reveal"
              style={reveal(330)}
            >
              <SectionHeading
                eyebrow="Requests"
                title="HTTP request parts are modeled as first-class product components."
                description="This set adds reusable request primitives for endpoint docs, internal tools, API explorers, and integration setup flows. URLs, headers, query params, and request bodies all share the same surface language."
              />

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Request composer</CardTitle>
                    <CardDescription>
                      Compact primitives for method, URL, headers, params, and payload samples.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <HttpRequest>
                      <HttpRequestBar>
                        <HttpMethodBadge method="POST" />
                        <HttpRequestUrl>
                          https://api.workspace.dev/v1/pages
                        </HttpRequestUrl>
                        <Button className="h-10 px-5 sm:self-auto">
                          <SendHorizonal className="size-4" />
                          Send
                        </Button>
                      </HttpRequestBar>

                      <div className="border-t border-border/75">
                        <HttpRequestSection
                          title="Query params"
                          description="Optional filters and expansions for this request."
                        >
                          <HttpRequestItems>
                            {requestQueryRows.map((item) => (
                              <HttpRequestItem
                                key={item.name}
                                name={item.name}
                                value={item.value}
                                meta={item.meta}
                              />
                            ))}
                          </HttpRequestItems>
                        </HttpRequestSection>

                        <HttpRequestSection
                          title="Headers"
                          description="Auth and routing metadata required by the API."
                          className="border-t border-border/75"
                        >
                          <HttpRequestItems>
                            {requestHeaderRows.map((item) => (
                              <HttpRequestItem
                                key={item.name}
                                name={item.name}
                                value={item.value}
                                meta={item.meta}
                                required={item.required}
                              />
                            ))}
                          </HttpRequestItems>
                        </HttpRequestSection>

                        <HttpRequestSection
                          title="Request body"
                          description="JSON payload sent with create and update operations."
                          className="border-t border-border/75"
                        >
                          <HttpRequestBody language="json">
                            <code>{requestBodyExample}</code>
                          </HttpRequestBody>
                        </HttpRequestSection>
                      </div>
                    </HttpRequest>
                  </CardContent>
                </Card>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,0.9fr)_minmax(340px,1.1fr)]">
                  <Card>
                    <CardHeader>
                      <CardTitle>Component set</CardTitle>
                      <CardDescription>
                        Building blocks for API reference pages and request configuration panels.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3">
                        {requestComponentTiles.map((tile) => (
                          <FeatureTile
                            key={tile.title}
                            icon={tile.icon}
                            title={tile.title}
                            description={tile.description}
                          />
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid gap-4">
                    <Card>
                      <CardHeader>
                        <CardTitle>Supported methods</CardTitle>
                        <CardDescription>
                          Method badges use the semantic request palette defined in tokens.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="flex flex-wrap gap-2">
                          <HttpMethodBadge method="GET" />
                          <HttpMethodBadge method="POST" />
                          <HttpMethodBadge method="PUT" />
                          <HttpMethodBadge method="PATCH" />
                          <HttpMethodBadge method="DELETE" />
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle>Composition example</CardTitle>
                        <CardDescription>
                          Drop the primitives into docs, admin tools, or API consoles.
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <pre className="overflow-x-auto font-mono text-[13px] leading-6 text-muted-foreground">
                          <code>{`<HttpRequest>
  <HttpRequestBar>
    <HttpMethodBadge method="POST" />
    <HttpRequestUrl>/v1/pages</HttpRequestUrl>
  </HttpRequestBar>
  <HttpRequestSection title="Request body">
    <HttpRequestBody language="json">{payload}</HttpRequestBody>
  </HttpRequestSection>
</HttpRequest>`}</code>
                        </pre>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="api-docs"
              className="space-y-5 editorial-reveal"
              style={reveal(360)}
            >
              <SectionHeading
                eyebrow="API docs"
                title="REST, webhook, and GraphQL patterns now sit on top of the same request language."
                description="The request primitives handle transport details. These higher-level components structure endpoint reference cards, webhook event docs, delivery logs, and GraphQL operation blocks without shifting into a different visual system."
              />

              <div className="space-y-4">
                <ApiEndpointCard>
                  <ApiEndpointHeader>
                    <ApiEndpointPath
                      method="POST"
                      path="/v1/pages"
                      stability="REST reference"
                    />
                    <div className="space-y-1">
                      <p className="text-lg font-semibold tracking-tight text-foreground">
                        Create page endpoint
                      </p>
                      <p className="max-w-[72ch] text-sm leading-7 text-muted-foreground">
                        Use a single endpoint frame for route identity, auth notes, versioning,
                        response states, and executable examples. This is the layer that API docs,
                        internal consoles, and onboarding guides can all share.
                      </p>
                    </div>
                  </ApiEndpointHeader>

                  <div className="space-y-4 p-4 xl:p-5">
                    <ApiEndpointMeta className="md:grid-cols-2 xl:grid-cols-2">
                      {restEndpointMeta.map((item) => (
                        <ApiEndpointMetaItem
                          key={item.label}
                          label={item.label}
                          value={item.value}
                          note={item.note}
                        />
                      ))}
                    </ApiEndpointMeta>

                    <div className="space-y-3 rounded-md border border-border/75 bg-background/80 p-4">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-foreground">
                          Response states
                        </p>
                        <p className="text-sm leading-6 text-muted-foreground">
                          Keep success, validation, auth, and throttling outcomes visible at
                          the same level as the route itself.
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {restResponseStates.map((state) => (
                          <ApiResponseBadge
                            key={state.code}
                            code={state.code}
                            label={state.label}
                            tone={state.tone}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-2">
                      <FeatureTile
                        icon={Route}
                        title="Route identity"
                        description="Method, path, and stability stay together so references scan fast."
                      />
                      <FeatureTile
                        icon={FileJson}
                        title="Executable samples"
                        description="cURL, SDK, and raw response tabs document transport and payloads in one place."
                      />
                    </div>

                    <ApiCodeTabs items={restCodeSamples} defaultValue="curl" />
                  </div>
                </ApiEndpointCard>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle>Webhook event docs</CardTitle>
                      <CardDescription>
                        Event cards explain what fires, where it lands, and how delivery behaves without turning docs into a dashboard.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid gap-3">
                        {webhookEvents.map((event) => (
                          <WebhookEventCard
                            key={event.event}
                            event={event.event}
                            title={event.title}
                            description={event.description}
                            destination={event.destination}
                            deliveryMode={event.deliveryMode}
                          />
                        ))}
                      </div>

                      <div className="space-y-3">
                        <div className="flex flex-wrap items-end justify-between gap-2">
                          <div className="space-y-1">
                            <p className="text-sm font-medium text-foreground">
                              Delivery sample
                            </p>
                            <p className="text-sm leading-6 text-muted-foreground">
                              Payload previews and recent attempts share the same calm chrome.
                            </p>
                          </div>
                          <Badge variant="outline">signed payload</Badge>
                        </div>

                        <ApiCodeTabs
                          items={[
                            {
                              value: 'payload',
                              label: 'Payload',
                              language: 'json',
                              caption: 'Webhook body example',
                              code: webhookPayloadExample,
                            },
                          ]}
                        />

                        <WebhookDeliveryList>
                          {webhookDeliveryRows.map((item) => (
                            <WebhookDeliveryItem
                              key={`${item.event}-${item.timestamp}`}
                              event={item.event}
                              status={item.status}
                              note={item.note}
                              timestamp={item.timestamp}
                              tone={item.tone}
                            />
                          ))}
                        </WebhookDeliveryList>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>GraphQL operations</CardTitle>
                      <CardDescription>
                        Operation cards pair signature, return shape, and field-level guidance inside a tighter schema-first surface.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <GraphqlOperationCard
                        kind="Query"
                        name="page"
                        description="Fetch a single document node with owner and update metadata for detail views."
                        signature="page(id: ID!): Page"
                        returns="Page"
                      >
                        <GraphqlFieldList>
                          <GraphqlField
                            name="id"
                            type="ID!"
                            description="Stable node identifier shared across REST routes and webhook payloads."
                            required
                          />
                          <GraphqlField
                            name="owner"
                            type="User"
                            description="Resolved author record for bylines, routing, and permissions UI."
                          />
                          <GraphqlField
                            name="updatedAt"
                            type="DateTime!"
                            description="Canonical last-write timestamp for list ordering and conflict hints."
                            required
                          />
                        </GraphqlFieldList>
                      </GraphqlOperationCard>

                      <GraphqlOperationCard
                        kind="Mutation"
                        name="publishPage"
                        description="Promote a draft to published state and fan out webhook notifications for downstream consumers."
                        signature="publishPage(input: PublishPageInput!): PublishPagePayload"
                        returns="PublishPagePayload"
                      >
                        <GraphqlFieldList>
                          <GraphqlField
                            name="input"
                            type="PublishPageInput!"
                            description="Carries page id, publish note, actor, and optional scheduled time."
                            required
                          />
                          <GraphqlField
                            name="page"
                            type="Page!"
                            description="Updated node returned for optimistic UI and confirmation summaries."
                            required
                          />
                          <GraphqlField
                            name="delivery"
                            type="WebhookDelivery"
                            description="Last delivery snapshot used by audit and integration consoles."
                          />
                        </GraphqlFieldList>
                      </GraphqlOperationCard>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle>Schema inventory</CardTitle>
                      <CardDescription>
                        Tabs cover executable examples, while compact schema cards show the building blocks behind them.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <ApiCodeTabs
                        items={graphqlOperationSamples}
                        defaultValue="query"
                      />

                      <ApiEndpointMeta className="md:grid-cols-2 xl:grid-cols-2">
                        {graphqlSchemaTypes.map((item) => (
                          <ApiEndpointMetaItem
                            key={item.label}
                            label={item.label}
                            value={item.value}
                            note={item.note}
                          />
                        ))}
                      </ApiEndpointMeta>

                      <div className="grid gap-3 md:grid-cols-2">
                        <FeatureTile
                          icon={Braces}
                          title="Typed fields"
                          description="Schemas stay readable when required flags and return types sit in the same row."
                        />
                        <FeatureTile
                          icon={GitBranch}
                          title="Delivery parity"
                          description="GraphQL mutations and webhooks can document the same downstream contracts."
                        />
                        <FeatureTile
                          icon={Webhook}
                          title="Event bridge"
                          description="Mutation payloads map cleanly to delivery logs and webhook event cards."
                        />
                        <FeatureTile
                          icon={Route}
                          title="Route parity"
                          description="REST and GraphQL examples can coexist without forking the visual system."
                        />
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </section>

            <section
              id="data"
              className="space-y-5 editorial-reveal"
              style={reveal(390)}
            >
              <SectionHeading
                eyebrow="Data"
                title="Lists and tables stay readable without turning into dashboard tiles."
                description="Database patterns should feel native to the editorial language. Row density, state chips, avatars, and timestamps all fit into the same neutral, warm structure."
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Document index</CardTitle>
                    <CardDescription>
                      Rich list rows for search results, collections, and recent pages.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ItemGroup>
                      {documentRows.map((row, index) => (
                        <div key={row.title}>
                          {index > 0 && <ItemSeparator />}
                          <Item
                            variant="default"
                            size="sm"
                            className="rounded-lg px-0 py-4"
                          >
                            <ItemMedia
                              variant="icon"
                              className="rounded-md border-border/70 bg-card"
                            >
                              <FileText className="size-4" />
                            </ItemMedia>
                            <ItemContent>
                              <ItemTitle>{row.title}</ItemTitle>
                              <ItemDescription>{row.description}</ItemDescription>
                            </ItemContent>
                            <ItemActions>
                              <StatusBadge label={row.status} tone={row.tone} />
                            </ItemActions>
                          </Item>
                        </div>
                      ))}
                    </ItemGroup>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Database table</CardTitle>
                    <CardDescription>
                      Table rows remain quiet and scannable even with frequent updates.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Page</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Owner</TableHead>
                          <TableHead>Area</TableHead>
                          <TableHead>Updated</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {databaseRows.map((row) => (
                          <TableRow key={row.name}>
                            <TableCell className="font-medium text-foreground">
                              {row.name}
                            </TableCell>
                            <TableCell>
                              <StatusBadge
                                label={row.status}
                                tone={
                                  row.status === 'ready'
                                    ? 'ready'
                                    : row.status === 'live'
                                      ? 'live'
                                      : 'draft'
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Avatar className="size-7">
                                  <AvatarImage src="/placeholder-user.jpg" alt={`${row.owner} avatar`} />
                                  <AvatarFallback>{row.owner}</AvatarFallback>
                                </Avatar>
                                <span className="text-sm text-muted-foreground">
                                  {row.owner}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.area}
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {row.updated}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section
              id="writing"
              className="space-y-5 editorial-reveal"
              style={reveal(420)}
            >
              <SectionHeading
                eyebrow="Writing"
                title="Documentation blocks feel native to the same product shell."
                description="This system treats docs and interfaces as the same medium. Callouts, code blocks, and editorial notes inherit the same border weight, spacing rhythm, and surface contrast."
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.02fr)_minmax(320px,0.98fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Document module</CardTitle>
                    <CardDescription>
                      Notes, specs, and handoff pages use the same calm visual language.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="editorial-callout flex gap-3">
                      <MessageSquareQuote className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <p className="text-sm leading-6 text-muted-foreground">
                        Callouts should feel like highlighted paragraphs, not alert banners.
                        They work best when they reinforce reading flow instead of interrupting it.
                      </p>
                    </div>

                    <div className="rounded-lg border border-border/70 bg-background/80 p-4">
                      <p className="text-sm font-medium text-foreground">
                        Page anatomy
                      </p>
                      <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                        <p>
                          Use one strong heading, a short setup paragraph, and then
                          alternate between content blocks and metadata panels.
                        </p>
                        <p>
                          Avoid stacking callout after callout. A single accented
                          surface should introduce context, not replace structure.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Code treatment</CardTitle>
                    <CardDescription>
                      Technical snippets should read like part of the document, not a separate app theme.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <pre className="editorial-code overflow-x-auto">
                      <code>{`<section className="editorial-surface px-6 py-5">
  <p className="editorial-section-kicker">Foundations</p>
  <h2 className="text-3xl tracking-tight">Quiet by default</h2>
  <p className="text-muted-foreground">
    Use one cool accent and let spacing define groups.
  </p>
</section>`}</code>
                    </pre>

                    <div className="rounded-lg border border-border/70 bg-background/80 p-3">
                      <p className="text-sm font-medium text-foreground">
                        Writing rules
                      </p>
                      <ul className="mt-3 space-y-2 text-sm leading-6 text-muted-foreground">
                        <li>Keep headings short and assertive.</li>
                        <li>Prefer descriptive helper copy over decorative labels.</li>
                        <li>Use callouts to frame intent, not to increase emphasis everywhere.</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section
              id="states"
              className="space-y-5 editorial-reveal"
              style={reveal(480)}
            >
              <SectionHeading
                eyebrow="States"
                title="Feedback stays inline, soft, and immediately actionable."
                description="The system does not lean on loud banners. Progress, alerts, and empty states remain lightweight so they can sit inside docs, databases, or side panels without breaking the page."
              />

              <div className="grid gap-4 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                <Card>
                  <CardHeader>
                    <CardTitle>Inline feedback</CardTitle>
                    <CardDescription>
                      Progress, validation, and system guidance for calm operational flows.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Alert>
                      <ShieldCheck className="size-4" />
                      <AlertTitle>Migration finished</AlertTitle>
                      <AlertDescription>
                        Navigation, forms, and data display now share the same neutral token set.
                      </AlertDescription>
                    </Alert>

                    <Alert variant="destructive">
                      <AlertCircle className="size-4" />
                      <AlertTitle>Missing block rules</AlertTitle>
                      <AlertDescription>
                        Add empty, loading, and error coverage before shipping new document modules.
                      </AlertDescription>
                    </Alert>

                    <div className="space-y-3 rounded-lg border border-border/70 bg-background/80 p-3">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          Component coverage
                        </p>
                        <span className="text-sm text-muted-foreground">78%</span>
                      </div>
                      <Progress value={78} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Empty state</CardTitle>
                    <CardDescription>
                      Empty views should teach the next action without introducing a separate visual theme.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Empty>
                      <EmptyHeader>
                        <EmptyMedia variant="icon">
                          <Library className="size-5" />
                        </EmptyMedia>
                        <EmptyTitle>No linked docs yet</EmptyTitle>
                        <EmptyDescription>
                          Start with a guide, meeting note, or database view. The system
                          keeps new pages aligned with the same layout and token rules.
                        </EmptyDescription>
                      </EmptyHeader>
                      <EmptyContent>
                        <div className="flex flex-wrap justify-center gap-3">
                          <Button>New page</Button>
                          <Button variant="outline">Browse templates</Button>
                        </div>
                      </EmptyContent>
                    </Empty>
                  </CardContent>
                </Card>
              </div>
            </section>

            <section
              id="enhanced-docs"
              className="space-y-5 editorial-reveal"
              style={reveal(510)}
            >
              <SectionHeading
                eyebrow="Enhanced Docs"
                title="Rich components for technical writing."
                description="Specialized components for callouts, file trees, image zooming, and JSON data exploration."
              />

              <div className="grid gap-4 xl:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Callouts</CardTitle>
                    <CardDescription>
                      Semantic highlights for important information.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Callout title="Note" type="default">
                      Standard information that should stand out from body text.
                    </Callout>
                    <Callout title="Pro Tip" type="tip">
                      Helpful suggestions to improve the user experience.
                    </Callout>
                    <Callout title="Warning" type="warning">
                      Critical information that requires user attention.
                    </Callout>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>File Tree</CardTitle>
                    <CardDescription>
                      Visualize directory structures and file organization.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FileTree
                      data={[
                        {
                          id: '1',
                          name: 'app',
                          type: 'folder',
                          children: [
                            { id: '2', name: 'page.tsx', type: 'file' },
                            { id: '3', name: 'layout.tsx', type: 'file' },
                          ],
                        },
                        {
                          id: '4',
                          name: 'components',
                          type: 'folder',
                          children: [
                            { id: '5', name: 'ui', type: 'folder', children: [{ id: '6', name: 'button.tsx', type: 'file' }] },
                          ],
                        },
                        { id: '7', name: 'package.json', type: 'file' },
                      ]}
                    />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Steps</CardTitle>
                    <CardDescription>
                      Sequenced instructions for tutorials and guides.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Steps>
                      <Step title="Install dependencies">
                        Run <code className="bg-muted px-1 py-0.5 rounded">npm install</code> to get started.
                      </Step>
                      <Step title="Configure environment">
                        Copy .env.example to .env.local and fill in secrets.
                      </Step>
                      <Step title="Run development server">
                        Start the local dev server with <code className="bg-muted px-1 py-0.5 rounded">npm run dev</code>.
                      </Step>
                    </Steps>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>JSON Viewer & Code</CardTitle>
                    <CardDescription>
                      Interactive data exploration and copy-ready code blocks.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <JsonViewer
                      data={{
                        user: { id: 1, name: 'Alice', role: 'admin' },
                        settings: { theme: 'dark', notifications: true },
                        tags: ['react', 'nextjs', 'ui']
                      }}
                      maxHeight={200}
                    />
                    <CodeBlock
                      language="bash"
                      code="npm install @radix-ui/react-slot"
                      copy={true}
                    />
                  </CardContent>
                </Card>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-2">
                 <Card>
                    <CardHeader>
                       <CardTitle>Zoom Image</CardTitle>
                       <CardDescription>Click to expand into a lightbox view.</CardDescription>
                    </CardHeader>
                    <CardContent>
                       <ZoomImage
                          src="/placeholder.svg"
                          alt="Placeholder chart"
                          caption="Detailed view of the system architecture"
                          width={600}
                          height={300}
                          className="w-full"
                       />
                    </CardContent>
                 </Card>

                 <Card>
                    <CardHeader>
                       <CardTitle>Feedback</CardTitle>
                       <CardDescription>Simple sentiment collection.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-center h-[140px]">
                       <Feedback />
                    </CardContent>
                 </Card>
              </div>
            </section>
          </main>
        </div>
        <BackToTop />
      </div>
    </div>
  )
}
