import {
  pgTable,
  text,
  timestamp,
} from 'drizzle-orm/pg-core'
import { relations } from 'drizzle-orm'
import { workspaces } from './schema-workspace'

export const workspaceBranding = pgTable('workspace_branding', {
  workspaceId: text('workspace_id')
    .primaryKey()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  logoUrl: text('logo_url'),
  faviconUrl: text('favicon_url'),
  primaryColor: text('primary_color'),
  accentColor: text('accent_color'),
  customDomain: text('custom_domain'),
  customCss: text('custom_css'),
  metaTitle: text('meta_title'),
  metaDescription: text('meta_description'),
  ogImageUrl: text('og_image_url'),
  updatedAt: timestamp('updated_at', { mode: 'date' }).notNull().defaultNow(),
})

export const workspaceBrandingRelations = relations(
  workspaceBranding,
  ({ one }) => ({
    workspace: one(workspaces, {
      fields: [workspaceBranding.workspaceId],
      references: [workspaces.id],
    }),
  }),
)
