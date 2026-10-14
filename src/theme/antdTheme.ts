import type { ThemeConfig } from 'antd';

/**
 * Global Ant Design token overrides.
 * The goal: AntD supplies behaviour, our design language supplies the look.
 * Everything here maps back to the tokens declared in styles/globals.css.
 */
export const antdTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1F4A8F',
    colorInfo: '#2563EB',
    colorSuccess: '#16A34A',
    colorWarning: '#CA8A04',
    colorError: '#E11D48',

    colorText: '#18181B',
    colorTextSecondary: '#52525B',
    colorTextTertiary: '#71717A',
    colorTextQuaternary: '#A1A1AA',
    colorTextPlaceholder: '#A1A1AA',

    // AntD's runtime reset styles bare <a> elements with colorLink. React Router
    // renders NavLinks as anchors, so this must stay neutral — components opt
    // into brand colour explicitly via their own classes.
    colorLink: '#3F3F46',
    colorLinkHover: '#18181B',
    colorLinkActive: '#18181B',

    colorBorder: '#E8E8EC',
    colorBorderSecondary: '#F1F1F4',
    colorSplit: '#E8E8EC',
    colorBgLayout: '#F7F8FA',
    colorBgContainer: '#FFFFFF',
    colorBgElevated: '#FFFFFF',
    colorFillAlter: '#FAFAFB',
    colorFillSecondary: '#F4F4F5',

    fontFamily: "'Inter', 'Noto Sans Thai', ui-sans-serif, system-ui, sans-serif",
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 15,
    fontSizeHeading5: 15,

    borderRadius: 8,
    borderRadiusSM: 6,
    borderRadiusLG: 10,
    borderRadiusXS: 4,

    controlHeight: 36,
    controlHeightSM: 30,
    controlHeightLG: 40,

    lineWidth: 1,
    motionDurationMid: '0.18s',
    motionDurationSlow: '0.26s',
    wireframe: false,

    boxShadow: '0 8px 24px -6px rgb(24 24 27 / 0.12), 0 2px 6px -2px rgb(24 24 27 / 0.06)',
    boxShadowSecondary: '0 8px 24px -6px rgb(24 24 27 / 0.12), 0 2px 6px -2px rgb(24 24 27 / 0.06)',
  },

  components: {
    Button: {
      fontWeight: 500,
      primaryShadow: 'none',
      defaultShadow: 'none',
      dangerShadow: 'none',
      paddingInline: 16,
      contentFontSize: 14,
      defaultBorderColor: '#E8E8EC',
      defaultColor: '#3F3F46',
      defaultHoverColor: '#18181B',
      defaultHoverBorderColor: '#D4D4D8',
      defaultHoverBg: '#FAFAFB',
      colorPrimaryHover: '#193E7A',
      colorPrimaryActive: '#143265',
    },

    Input: {
      paddingInline: 12,
      activeShadow: '0 0 0 3px rgb(31 74 143 / 0.12)',
      hoverBorderColor: '#D4D4D8',
      activeBorderColor: '#1F4A8F',
      colorBgContainer: '#FFFFFF',
    },

    InputNumber: {
      activeShadow: '0 0 0 3px rgb(31 74 143 / 0.12)',
      hoverBorderColor: '#D4D4D8',
    },

    Select: {
      optionSelectedBg: '#EFF4FB',
      optionSelectedColor: '#143265',
      optionSelectedFontWeight: 500,
      optionActiveBg: '#FAFAFB',
      optionPadding: '6px 12px',
      hoverBorderColor: '#D4D4D8',
      activeBorderColor: '#1F4A8F',
      activeOutlineColor: 'rgb(31 74 143 / 0.12)',
      controlItemBgActive: '#EFF4FB',
    },

    DatePicker: {
      activeBorderColor: '#1F4A8F',
      hoverBorderColor: '#D4D4D8',
      activeShadow: '0 0 0 3px rgb(31 74 143 / 0.12)',
      cellActiveWithRangeBg: '#EFF4FB',
    },

    Table: {
      headerBg: '#FAFAFB',
      headerColor: '#52525B',
      headerSplitColor: 'transparent',
      headerBorderRadius: 0,
      borderColor: '#F1F1F4',
      rowHoverBg: '#FAFAFB',
      rowSelectedBg: '#F7FAFD',
      rowSelectedHoverBg: '#EFF4FB',
      cellPaddingBlock: 14,
      cellPaddingInline: 16,
      cellFontSize: 14,
      footerBg: '#FFFFFF',
      bodySortBg: 'transparent',
      headerSortActiveBg: '#F4F4F5',
      headerSortHoverBg: '#F4F4F5',
    },

    Modal: {
      borderRadiusLG: 12,
      headerBg: 'transparent',
      titleFontSize: 17,
      titleColor: '#18181B',
      contentBg: '#FFFFFF',
      paddingContentHorizontalLG: 0,
    },

    Drawer: {
      paddingLG: 0,
      footerPaddingBlock: 14,
      footerPaddingInline: 24,
    },

    Dropdown: {
      borderRadiusLG: 10,
      controlItemBgHover: '#FAFAFB',
      controlItemBgActive: '#EFF4FB',
      paddingBlock: 6,
    },

    Menu: {
      itemBorderRadius: 8,
      itemSelectedBg: '#EFF4FB',
      itemSelectedColor: '#143265',
      itemHoverBg: '#FAFAFB',
      itemHeight: 38,
      iconMarginInlineEnd: 10,
      activeBarWidth: 0,
    },

    Tooltip: {
      colorBgSpotlight: '#10284F',
      borderRadius: 6,
      fontSize: 12.5,
      controlHeight: 28,
    },

    Tabs: {
      itemColor: '#71717A',
      itemSelectedColor: '#18181B',
      itemHoverColor: '#18181B',
      inkBarColor: '#1F4A8F',
      titleFontSize: 14,
      horizontalItemPadding: '10px 0',
      horizontalItemGutter: 24,
    },

    Pagination: {
      itemActiveBg: '#EFF4FB',
      itemSize: 32,
      colorPrimary: '#143265',
      colorPrimaryHover: '#143265',
      itemBg: '#FFFFFF',
    },

    Form: {
      labelColor: '#3F3F46',
      labelFontSize: 13,
      verticalLabelPadding: '0 0 6px',
      itemMarginBottom: 18,
      labelRequiredMarkColor: '#E11D48',
    },

    Upload: {
      colorBorder: '#E8E8EC',
      actionsColor: '#71717A',
    },

    Checkbox: {
      borderRadiusSM: 4,
      controlInteractiveSize: 16,
    },

    Badge: {
      dotSize: 7,
      statusSize: 6,
      textFontSize: 11,
      textFontSizeSM: 10,
      indicatorHeight: 18,
      indicatorHeightSM: 15,
    },

    Segmented: {
      itemSelectedBg: '#FFFFFF',
      itemSelectedColor: '#18181B',
      trackBg: '#F4F4F5',
      itemHoverBg: 'transparent',
      trackPadding: 3,
      borderRadius: 8,
      borderRadiusSM: 6,
    },

    Steps: {
      colorPrimary: '#1F4A8F',
      iconSize: 26,
      iconFontSize: 13,
      titleLineHeight: 22,
    },

    Progress: {
      defaultColor: '#1F4A8F',
      remainingColor: '#F1F1F4',
    },

    Switch: {
      colorPrimary: '#1F4A8F',
      colorPrimaryHover: '#193E7A',
    },

    Divider: {
      colorSplit: '#E8E8EC',
      marginLG: 20,
    },

    Message: {
      contentPadding: '10px 16px',
      borderRadiusLG: 8,
    },

    Empty: {
      colorTextDescription: '#71717A',
    },

    Skeleton: {
      colorFill: '#EDEDF0',
      colorFillContent: '#F4F4F5',
    },

    Avatar: {
      containerSize: 34,
      textFontSize: 13,
      borderRadius: 8,
    },

    Popconfirm: {
      colorWarning: '#CA8A04',
    },
  },
};
