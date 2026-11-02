import { PARAM_GROUPS, PARAMS } from '@prompt-grader/engine';
import { t } from '../../i18n';
import './controls.css';
import { ParamGroup } from './ParamGroup';

const OPEN_BY_DEFAULT = new Set<string>(['amount', 'light', 'foliage', 'split']);

export function Controls() {
  return (
    <>
      <h2 className="visually-hidden">{t('controls.label')}</h2>
      {PARAM_GROUPS.map((group) => (
        <ParamGroup
          key={group.id}
          group={group}
          params={PARAMS.filter((p) => p.group === group.id)}
          defaultOpen={OPEN_BY_DEFAULT.has(group.id)}
        />
      ))}
    </>
  );
}
