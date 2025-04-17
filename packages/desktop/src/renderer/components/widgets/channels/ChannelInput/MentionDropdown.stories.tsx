import React from 'react'
import { ComponentStory, ComponentMeta } from '@storybook/react'
import { withTheme } from '../../../../storybook/decorators'
import MentionDropdown from './MentionDropdown'

export default {
  title: 'Components/ChannelInput/MentionDropdown',
  component: MentionDropdown,
  decorators: [withTheme],
  parameters: {
    layout: 'centered',
  },
} as ComponentMeta<typeof MentionDropdown>

const Template: ComponentStory<typeof MentionDropdown> = args => {
  return (
    <div style={{ padding: '20px', height: '400px' }}>
      <MentionDropdown {...args} />
    </div>
  )
}

const exampleUsernames = [
  'alpha',
  'beta',
  'gamma',
  'delta',
  'epsilon',
  'zeta',
  'eta',
  'theta',
  'iota',
  'kappa',
  'lambda',
  'mu',
  'nu',
  'omicron',
  'pi',
  'rho',
  'sigma',
  'tau',
  'upsilon',
  'phi',
  'chi',
  'psi',
  'omega',
  'alep',
  'bet',
  'giml',
  'dalet',
  'he',
  'waw',
  'zayin',
  'het',
  'tet',
  'yod',
  'kap',
  'lamed',
  'mem',
  'nun',
  'samek',
  'ayin',
  'pe',
  'sade',
  'qop',
  'res',
  'sin',
  'taw',
]

// Simple example with many emoji options to demonstrate scrolling
export const Default = Template.bind({})
Default.args = {
  suggestions: exampleUsernames.slice(0, 30),
  selectedIndex: 0,
  position: { top: 0, left: 0, width: 300 },
  onClickAway: () => console.log('Click away'),
  onMentionableSelect: username => console.log('Selected:', username),
}

// Example positioned at the edge to demonstrate overflow handling
export const EdgePosition = Template.bind({})
EdgePosition.args = {
  suggestions: exampleUsernames.slice(0, 10),
  selectedIndex: 0,
  position: { top: 0, left: 500, width: 300 },
  onClickAway: () => console.log('Click away'),
  onMentionableSelect: username => console.log('Selected:', username),
}

// // Example with many emojis
// export const ManyEmojis = Template.bind({})
// ManyEmojis.args = {
//   suggestions: exampleUsernames.slice(0, 50),
//   selectedIndex: 0,
//   position: { top: 0, left: 0, width: 300 },
//   onClickAway: () => console.log('Click away'),
//   onMentionableSelect: username => console.log('Selected:', username),
// }

// Example with a selected item
export const SelectedItem = Template.bind({})
SelectedItem.args = {
  suggestions: exampleUsernames.slice(0, 20),
  selectedIndex: 5,
  position: { top: 0, left: 0, width: 300 },
  onClickAway: () => console.log('Click away'),
  onMentionableSelect: username => console.log('Selected:', username),
}
