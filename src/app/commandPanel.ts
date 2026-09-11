import type {
  SmartCubeCapabilities,
  SmartCubeCommand,
  SmartCubeVendorCommand,
} from 'smartcube-web-bluetooth';

type CommandPanelOptions = {
  sendCommand: (command: SmartCubeCommand) => Promise<void>;
  sendVendorCommand: (command: SmartCubeVendorCommand) => Promise<void>;
  /** Runs before a supported command is sent, while its button is disabled. */
  onBeforeSend?: (command: SmartCubeCommand | SmartCubeVendorCommand) => void;
  onResult: (name: string, error?: unknown) => void;
  confirm?: (message: string) => boolean;
};

type Action = {
  name: string;
  command: SmartCubeCommand | SmartCubeVendorCommand;
  confirm?: string;
};

const vendorLabels: Record<SmartCubeVendorCommand['type'], string> = {
  REBOOT: 'Reboot cube',
  SET_ORIENTATION_ENABLED: 'Enable gyro',
  CALIBRATE_ORIENTATION: 'Calibrate gyro',
  FLASH_BACKLIGHT: 'Flash light',
  SLOW_FLASH_BACKLIGHT: 'Slow flash',
  TOGGLE_ANIMATED_BACKLIGHT: 'Toggle animated light',
  TOGGLE_BACKLIGHT: 'Toggle light',
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
        ? [{ name: 'Sync state', command: { type: 'REQUEST_FACELETS' } as SmartCubeCommand }]
        : []),
      ...(capabilities.battery
        ? [{ name: 'Refresh battery', command: { type: 'REQUEST_BATTERY' } as SmartCubeCommand }]
        : []),
      ...(capabilities.hardware
        ? [{ name: 'Refresh hardware', command: { type: 'REQUEST_HARDWARE' } as SmartCubeCommand }]
        : []),
      ...(capabilities.vendorCommands ?? []).flatMap((type): Action[] => {
        if (type === 'SET_ORIENTATION_ENABLED') {
          return [
            { name: 'Enable gyro', command: { vendor: 'gocube', type, enabled: true } },
            { name: 'Disable gyro', command: { vendor: 'gocube', type, enabled: false } },
          ];
        }
        return [
          {
            name: vendorLabels[type],
            command: { vendor: 'gocube', type } as SmartCubeVendorCommand,
            ...(type === 'REBOOT' ? { confirm: 'Reboot the cube now?' } : {}),
          },
        ];
      }),
    ];
    if (actions.length === 0) return clear();

    const heading = document.createElement('h3');
    heading.textContent = 'Cube commands';
    const controls = document.createElement('div');
    controls.className = 'command-panel-actions';
    actions.forEach((action) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = action.name;
      button.addEventListener('click', async () => {
        if (action.confirm && !(options.confirm ?? window.confirm)(action.confirm)) return;
        button.disabled = true;
        try {
          options.onBeforeSend?.(action.command);
          if ('vendor' in action.command) await options.sendVendorCommand(action.command);
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
    panel.replaceChildren(heading, controls);
    panel.hidden = false;
  };

  return { clear, render };
}
