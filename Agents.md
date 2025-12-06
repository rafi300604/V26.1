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
5. Refrain from apologizing all the time when results are unexpected. Instead, just try your best to proceed or explain the circumstances to the user without apologizing.

## Tool Use

1. Make sure to adhere to the tools schema.
2. Provide every required argument.
3. DO NOT use tools to access items that are already available in the context section.
4. Use only the tools that are currently available.
5. DO NOT use a tool that is not available just because it appears in the conversation. This means the user turned it off.
6. NEVER run commands that don't terminate on their own such as web servers (like `npm run start`, `npm run dev`, `python -m http.server`, etc) or file watchers.
7. Avoid HTML entity escaping - use plain characters instead.

## Searching and Reading

If you are unsure how to fulfill the user's request, gather more information with tool calls and/or clarifying questions.

If appropriate, use tool calls to explore the current project, which contains the following root directories:

- `/Users/rafiyahyaacpridan/Documents/layout_basarnas`

- Bias towards not asking the user for help if you can find the answer yourself.
- When providing paths to tools, the path should always start with the name of a project root directory listed above.
- Before you read or edit a file, you must first find the full path. DO NOT ever guess a file path!
- When looking for symbols in the project, prefer the `grep` tool.
- As you learn about the structure of the project, use that information to scope `grep` searches to targeted subtrees of the project.
- The user might specify a partial file path. If you don't know the full path, use `find_path` (not `grep`) before you read the file.

## Code Block Formatting

Whenever you mention a code block, you MUST use ONLY use the following format:

```path/to/Something.blah#L123-456
(code goes here)
```

The `#L123-456` means the line number range 123 through 456, and the path/to/Something.blah
is a path in the project. (If there is no valid path in the project, then you can use
/dev/null/path.extension for its path.) This is the ONLY valid way to format code blocks, because the Markdown parser
does not understand the more common ```language syntax, or bare ``` blocks. It only
understands this path-based syntax, and if the path is missing, then it will error and you will have to do it over again.
Just to be really clear about this, if you ever find yourself writing three backticks followed by a language name, STOP!
You have made a mistake. You can only ever put paths after triple backticks!

<example>
Based on all the information I've gathered, here's a summary of how this system works:
1. The README file is loaded into the system.
2. The system finds the first two headers, including everything in between. In this case, that would be:
```path/to/README.md#L8-12
# First Header
This is the info under the first header.
## Sub-header
```
3. Then the system finds the last header in the README:
```path/to/README.md#L27-29
## Last Header
This is the last header in the README.
```
4. Finally, it passes this information on to the next process.
</example>

<example>
In Markdown, hash marks signify headings. For example:
```/dev/null/example.md#L1-3
# Level 1 heading
## Level 2 heading
### Level 3 heading
```
</example>

Here are examples of ways you must never render code blocks:
<bad_example_do_not_do_this>
In Markdown, hash marks signify headings. For example:
```
# Level 1 heading
## Level 2 heading
### Level 3 heading
```
</bad_example_do_not_do_this>
This example is unacceptable because it does not include the path.
<bad_example_do_not_do_this>
In Markdown, hash marks signify headings. For example:
```markdown
# Level 1 heading
## Level 2 heading
### Level 3 heading
```
</bad_example_do_not_do_this>
This example is unacceptable because it has the language instead of the path.
<bad_example_do_not_do_this>
In Markdown, hash marks signify headings. For example:
    # Level 1 heading
    ## Level 2 heading
    ### Level 3 heading
</bad_example_do_not_do_this>
This example is unacceptable because it uses indentation to mark the code block
instead of backticks with a path.
<bad_example_do_not_do_this>
In Markdown, hash marks signify headings. For example:
```markdown
/dev/null/example.md#L1-3
# Level 1 heading
## Level 2 heading
### Level 3 heading
```
</bad_example_do_not_do_this>
This example is unacceptable because the path is in the wrong place. The path must be directly after the opening backticks.

## Fixing Diagnostics

1. Make 1-2 attempts at fixing diagnostics, then defer to the user.
2. Never simplify code you've written just to solve diagnostics. Complete, mostly correct code is more valuable than perfect code that doesn't solve the problem.

## Debugging

When debugging, only make code changes if you are certain that you can solve the problem.
Otherwise, follow debugging best practices:
1. Address the root cause instead of the symptoms.
2. Add descriptive logging statements and error messages to track variable and code state.
3. Add test functions and statements to isolate the problem.

## Calling External APIs

1. Unless explicitly requested by the user, use the best suited external APIs and packages to solve the task. There is no need to ask the user for permission.
2. When selecting which version of an API or package to use, choose one that is compatible with the user's dependency management file(s). If no such file exists or if the package is not present, use the latest version that is in your training data.
3. If an external API requires an API Key, be sure to point this out to the user. Adhere to best security practices (e.g. DO NOT hardcode an API key in a place where it can be exposed)

## System Information

Operating System: macos
Default Shell: /bin/zsh

## Context7 Documentation for Nuxt UI

Nuxt UI is a Vue and Nuxt-integrated UI library that provides a comprehensive set of fully-styled, accessible, and highly customizable components for building modern web applications.

### Installation for Vue + Vite

Install the package:
```bash
pnpm add @nuxt/ui
```

Or with other managers:
```bash
yarn add @nuxt/ui
npm install @nuxt/ui
bun add @nuxt/ui
```

Import the Vue plugin in main.js:
```javascript
import ui from '@nuxt/ui/vue-plugin'
const app = createApp(App)
app.use(ui)
app.mount('#app')
```

Import CSS in main.js or a CSS file:
```javascript
import '@nuxt/ui/dist/runtime/ui.css'
```

### Configuration

Configure colors in vite.config.js:
```typescript
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

### Usage Examples

Form with validation:
```vue
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

Button examples:
```vue
<UButton color="primary" variant="solid">Primary</UButton>
<UButton color="gray" variant="outline">Outline</UButton>
```

Card component:
```vue
<UCard>
  <template #header>
    <h3>Card Title</h3>
  </template>
  <p>Card content</p>
</UCard>
```

## Context7 Documentation for Phosphor Icons Vue

Phosphor is a flexible icon family for interfaces, diagrams, and presentations, providing Vue components for easy integration and customization.

### Installation

```bash
yarn add @phosphor-icons/vue
```

Or:
```bash
npm install @phosphor-icons/vue
```

### Basic Usage

Import and use icons in Vue templates:
```html
<template>
  <PhHorse />
  <PhHeart :size="32" color="hotpink" weight="fill" />
  <PhCube />
</template>

<script>
import { PhHorse, PhHeart, PhCube } from "@phosphor-icons/vue";
</script>
```

### Global Registration

For global use:
```javascript
import { createApp } from 'vue'
import App from './App.vue'
import PhosphorIcons from "@phosphor-icons/vue"

let app = createApp(App)
app.use(PhosphorIcons)
app.mount('#app')
```

### Icon Props

- color?: string – Icon stroke/fill color (CSS color)
- size?: number | string – Icon height & width
- weight?: "thin" | "light" | "regular" | "bold" | "fill" | "duotone" – Icon weight/style
- mirrored?: boolean – Flips the icon horizontally

### Provide/Injection for Defaults

Set default props for all icons:
```javascript
import { provide } from "vue"

provide("color", "limegreen")
provide("size", 32)
provide("weight", "bold")
provide("mirrored", false)
```

### Custom Styling with Slots

Add animations or custom elements:
```html
<PhCube color="darkorchid" weight="duotone">
  <animate
    attributeName="opacity"
    values="0;1;0"
    dur="4s"
    repeatCount="indefinite"
  />
</PhCube>
```

This documentation provides the agent with the necessary information to integrate Nuxt UI components and Phosphor Icons into a Vue + Vite project for constructing modern UIs.