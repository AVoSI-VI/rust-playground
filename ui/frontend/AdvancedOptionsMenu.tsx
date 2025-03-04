import React, { useCallback } from 'react';

import * as config from './reducers/configuration';
import { Either as EitherConfig, Select as SelectConfig } from './ConfigElement';
import MenuGroup from './MenuGroup';
import * as selectors from './selectors';
import { Backtrace, Edition } from './types';
import { useAppDispatch, useAppSelector } from './hooks';

const AdvancedOptionsMenu: React.FC = () => {
  const isEditionDefault = useAppSelector(selectors.isEditionDefault);
  const edition = useAppSelector((state) => state.configuration.edition);
  const isBacktraceSet = useAppSelector(selectors.getBacktraceSet);
  const backtrace = useAppSelector((state) => state.configuration.backtrace);

  const dispatch = useAppDispatch();

  const changeEdition = useCallback((e: Edition) => dispatch(config.changeEdition(e)), [dispatch]);
  const changeBacktrace = useCallback((b: Backtrace) => dispatch(config.changeBacktrace(b)), [dispatch]);

  return (
    <MenuGroup title="Advanced options">
      <SelectConfig
        name="Edition"
        value={edition}
        isNotDefault={!isEditionDefault}
        onChange={changeEdition}
      >
        <option value={Edition.Rust2015}>2015</option>
        <option value={Edition.Rust2018}>2018</option>
        <option value={Edition.Rust2021}>2021</option>
        <option value={Edition.Rust2024}>2024</option>
      </SelectConfig>

      <EitherConfig
        id="backtrace"
        name="Backtrace"
        a={Backtrace.Disabled}
        b={Backtrace.Enabled}
        value={backtrace}
        isNotDefault={isBacktraceSet}
        onChange={changeBacktrace} />
    </MenuGroup>
  );
};

export default AdvancedOptionsMenu;
