import type {
  SmartCubeCapabilities,
  SmartCubeCommand,
  SmartCubeVendorCommand,
} from 'smartcube-web-bluetooth';

type CommandPanelOptions = {
  sendCommand: (command: SmartCubeCommand) => Promise<void>;
  /** Request state and wait until the cube provides the authoritative snapshot. */
  syncState?: () => Promise<unknown>;
  sendVendorCommand: (command: SmartCubeVendorCommand) => Promise<void>;
  /** Runs before a supported command is sent, while its button is disabled. */
  onBeforeSend?: (command: SmartCubeCommand | SmartCubeVendorCommand) => void;
  /** Runs immediately before dispatch, after local pre-send state has been prepared. */
  onSend?: (name: string, command: SmartCubeCommand | SmartCubeVendorCommand) => void;
  onResult: (name: string, error?: unknown) => void;
  confirm?: (message: string) => boolean;
};

type Group = 'State' | 'Gyro' | 'Backlight';

type Action = {
  name: string;
  command: SmartCubeCommand | SmartCubeVendorCommand;
  confirm?: string;
  group: Group;
};

const groupOrder: Group[] = ['State', 'Gyro', 'Backlight'];

const vendorLabels: Record<SmartCubeVendorCommand['type'], string> = {
  REBOOT: 'Reboot cube',
  SET_ORIENTATION_ENABLED: 'Enable gyro',
  CALIBRATE_ORIENTATION: 'Calibrate gyro',
  FLASH_BACKLIGHT: 'Flash light',
  SLOW_FLASH_BACKLIGHT: 'Slow flash',
  TOGGLE_ANIMATED_BACKLIGHT: 'Toggle animated light',
  TOGGLE_BACKLIGHT: 'Toggle light',
};

const vendorGroups: Record<SmartCubeVendorCommand['type'], Group> = {
  REBOOT: 'State',
  SET_ORIENTATION_ENABLED: 'Gyro',
  CALIBRATE_ORIENTATION: 'Gyro',
  FLASH_BACKLIGHT: 'Backlight',
  SLOW_FLASH_BACKLIGHT: 'Backlight',
  TOGGLE_ANIMATED_BACKLIGHT: 'Backlight',
  TOGGLE_BACKLIGHT: 'Backlight',
};

function root(): HTMLElement {
  const element = document.getElementById('command-panel');
  if (!element) throw new Error('Missing command panel');
  return element;
}

export function createCommandPanel() {
  const panel = root();

  const clear = (): void => {
    panel.hidden = true;
    panel.replaceChildren();
  };

  const render = (capabilities: SmartCubeCapabilities, options: CommandPanelOptions): void => {
    const actions: Action[] = [
      ...(capabilities.facelets
        ? [
            {
              name: 'Sync state',
              command: { type: 'REQUEST_FACELETS' } as SmartCubeCommand,
              group: 'State' as const,
            },
          ]
        : []),
      ...(capabilities.battery
        ? [
            {
              name: 'Refresh battery',
              command: { type: 'REQUEST_BATTERY' } as SmartCubeCommand,
              group: 'State' as const,
            },
          ]
        : []),
      ...(capabilities.hardware
        ? [
            {
              name: 'Refresh hardware',
              command: { type: 'REQUEST_HARDWARE' } as SmartCubeCommand,
              group: 'State' as const,
            },
          ]
        : []),
      ...(capabilities.vendorCommands ?? []).flatMap((type): Action[] => {
        if (type === 'SET_ORIENTATION_ENABLED') {
          return [
            {
              name: 'Enable gyro',
              command: { vendor: 'gocube', type, enabled: true },
              group: 'Gyro',
            },
            {
              name: 'Disable gyro',
              command: { vendor: 'gocube', type, enabled: false },
              group: 'Gyro',
            },
          ];
        }
        return [
          {
            name: vendorLabels[type],
            command: { vendor: 'gocube', type },
            group: vendorGroups[type],
            ...(type === 'REBOOT' ? { confirm: 'Reboot the cube now?' } : {}),
          },
        ];
      }),
    ];
    if (actions.length === 0) return clear();

    const heading = document.createElement('h3');
    heading.textContent = 'Cube commands';
    const groups = groupOrder
      .map((group) => ({ group, items: actions.filter((action) => action.group === group) }))
      .filter(({ items }) => items.length > 0);

    const sections = groups.map(({ group, items }) => {
      const section = document.createElement('div');
      section.className = 'command-group';
      const label = document.createElement('span');
      label.className = 'command-group-label';
      label.textContent = group;
      const controls = document.createElement('div');
      controls.className = 'command-panel-actions';
      items.forEach((action) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = action.name;
        button.addEventListener('click', async () => {
          if (action.confirm && !(options.confirm ?? window.confirm)(action.confirm)) return;
          button.disabled = true;
          try {
            options.onBeforeSend?.(action.command);
            options.onSend?.(action.name, action.command);
            if (
              'type' in action.command &&
              action.command.type === 'REQUEST_FACELETS' &&
              options.syncState
            )
              await options.syncState();
            else if ('vendor' in action.command) await options.sendVendorCommand(action.command);
            else await options.sendCommand(action.command);
            options.onResult(action.name);
          } catch (error) {
            options.onResult(action.name, error);
          } finally {
            button.disabled = false;
          }
        });
        controls.append(button);
      });
      section.append(label, controls);
      return section;
    });
    panel.replaceChildren(heading, ...sections);
    panel.hidden = false;
  };

  return { clear, render };
}
