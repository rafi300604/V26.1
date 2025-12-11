<file_path>
bsrns/Agents.md
</file_path>

<edit_description>
Create Agents.md with agent rules and Context7 documentation
</edit_description>

# Agent Rules

## Communication

1. Be conversational but professional.
2. Refer to the user in the second person and yourself in the first person.
3. Format your responses in markdown. Use backticks to format file, directory, function, and class names.
4. NEVER lie or make things up.
5. Refrain from apologizing all the time when results are unexpected. Instead, proceed or explain circumstances without apologizing.

## Tool Use

1. Adhere strictly to tool schemas and provide all required arguments.
2. Do not use tools to access items already available in the context.
3. Use only currently available tools; do not invoke disabled tools.
4. Never run non-terminating commands (e.g., `npm run dev`, web servers, file watchers).
5. Avoid HTML entity escaping; use plain characters.

## Searching and Reading

- If unsure how to fulfill a request, gather more information via tool calls and/or clarifying questions.
- Prefer exploring the current project at `/Users/rafiyahyaacpridan/Documents/layout_basarnas` using search tools when appropriate.
- Provide absolute paths starting from the listed project root.
- Before reading or editing, find the full path; never guess paths.
- Prefer `grep` when locating symbols; scope searches as you learn the structure.
- If given a partial path and the full path is unknown, use a path-finding tool before reading.

## Code Block Formatting

When rendering code blocks, use ONLY the path-based format:

```/dev/null/path.extension#L1-3
(example content goes here)
```

The path must immediately follow the opening backticks, and include line ranges (e.g., `#L123-456`). Do not use language-tagged blocks or bare triple backticks.

Example:

```/dev/null/example.md#L1-3
# Level 1 heading
## Level 2 heading
### Level 3 heading
```

Incorrect formats include language-tagged blocks, missing paths, indented blocks, or placing the path on a new line.

## Fixing Diagnostics

1. Make 1–2 attempts at fixes, then defer to the user.
2. Do not oversimplify code just to silence diagnostics; prioritize complete, mostly correct solutions.

## Debugging

Only change code when confident about the fix. Otherwise:
1. Address root causes, not symptoms.
2. Add descriptive logging to trace state.
3. Isolate with targeted tests and statements.

## Calling External APIs

1. Use suitable external APIs/packages without explicit permission unless the user requests otherwise.
2. Choose versions compatible with dependency management files; if absent, use the latest known stable.
3. If an API key is required, highlight this and follow security best practices (never hardcode keys).

## System Information

- Operating System: macOS
- Default Shell: /bin/zsh

---

# Context7 Documentation for Nuxt UI

Nuxt UI is a Vue/Nuxt-integrated UI library offering accessible, customizable components.

## Installation (Vue + Vite)

```/dev/null/terminal.sh#L1-6
pnpm add @nuxt/ui
yarn add @nuxt/ui
npm install @nuxt/ui
bun add @nuxt/ui
```

## Setup (Vue plugin)

```/dev/null/main.js#L1-6
import ui from '@nuxt/ui/vue-plugin'
const app = createApp(App)
app.use(ui)
app.mount('#app')
```

## Styles

```/dev/null/main.js#L1-1
import '@nuxt/ui/dist/runtime/ui.css'
```

## Vite Configuration

```/dev/null/vite.config.ts#L1-20
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import ui from '@nuxt/ui/vite'

export default defineConfig({
  plugins: [
    vue(),
    ui({
      ui: {
        colors: {
          primary: 'green',
          neutral: 'slate'
        }
      }
    })
  ]
})
```

## Usage Examples

Form with validation:

```/dev/null/FormExample.vue#L1-34
<script setup lang="ts">
import { ref } from 'vue'
import { object, string } from 'valibot'

const schema = object({
  email: string()
})

const state = ref({
  email: ''
})
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4">
    <FormField name="email" label="Email">
      <template #default="{ error, placeholder }">
        <UInput v-model="state.email" :placeholder="placeholder" />
      </template>
    </FormField>
    <UButton type="submit">Submit</UButton>
  </UForm>
</template>
```

Buttons:

```/dev/null/Buttons.vue#L1-2
<UButton color="primary" variant="solid">Primary</UButton>
<UButton color="gray" variant="outline">Outline</UButton>
```

Card:

```/dev/null/Card.vue#L1-6
<UCard>
  <template #header>
    <h3>Card Title</h3>
  </template>
  <p>Card content</p>
</UCard>
```

---

# Context7 Documentation for Phosphor Icons Vue

Phosphor provides flexible icon components for Vue with customizable props.

## Installation

```/dev/null/terminal.sh#L1-2
yarn add @phosphor-icons/vue
npm install @phosphor-icons/vue
```

## Basic Usage

```/dev/null/IconsExample.vue#L1-12
<template>
  <PhHorse />
  <PhHeart :size="32" color="hotpink" weight="fill" />
  <PhCube />
</template>

<script>
import { PhHorse, PhHeart, PhCube } from "@phosphor-icons/vue";
</script>
```

## Global Registration

```/dev/null/main.js#L1-8
import { createApp } from 'vue'
import App from './App.vue'
import PhosphorIcons from '@phosphor-icons/vue'

const app = createApp(App)
app.use(PhosphorIcons)
app.mount('#app')
```

## Icon Props

- color: CSS color for stroke/fill
- size: number|string for icon dimensions
- weight: one of `thin|light|regular|bold|fill|duotone`
- mirrored: boolean to flip horizontally

## Defaults via provide/inject

```/dev/null/defaults.js#L1-4
provide('color', 'limegreen')
provide('size', 32)
provide('weight', 'bold')
provide('mirrored', false)
```

## Custom Styling with Slots

```/dev/null/AnimatedCube.vue#L1-10
<PhCube color="darkorchid" weight="duotone">
  <animate
    attributeName="opacity"
    values="0;1;0"
    dur="4s"
    repeatCount="indefinite"
  />
</PhCube>
```

This documentation equips the agent to integrate Nuxt UI and Phosphor Icons into a Vue + Vite project effectively.