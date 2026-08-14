# marker-linter

Show linter messages on the scrollbar and minimap.

A marker layer that renders the diagnostics reported through the [linter](https://github.com/lumine-code/linter) package, drawn by [scrollmap](https://github.com/lumine-code/scrollmap) on the scrollbar and by [minimap](https://github.com/lumine-code/minimap) on the minimap.

## Features

- **Message markers**: shows linter errors, warnings and infos as overview markers, with hints hidden by default.
- **Severity colors**: markers are colored by message severity via theme colors.
- **Range merging**: adjacent messages of the same severity are merged into a single marker.
- **Threshold**: optionally hide all markers when the message count gets too large.

## Installation

To install `marker-linter` search for it in the Install pane of the Lumine settings, or run the command `lumine --install lumine-code/marker-linter`.

## Customization

The style can be adjusted in the `styles.css` file, e.g. recolor markers of a given severity:

```css
.marker.marker-linter {
  &.warning {
    background-color: var(--text-color-modified);
  }
}
```

## Services

- `marker.layer`: provided to register the `linter` marker layer drawn by the editor's overview maps.
- `linter.ui`: provided to receive linter message patches from the linter package.

## Contributing

Got ideas to make this package better, found a bug, or want to help add new features? Just drop your thoughts on GitHub. Any feedback is welcome!
