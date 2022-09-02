/*
 *  Copyright 2022 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

import { Col, Empty, Row, Select, Space, Typography } from 'antd';
import { AxiosError } from 'axios';
import { isEmpty } from 'lodash';
import moment from 'moment';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Legend,
  Line,
  LineChart,
  LineProps,
  ReferenceArea,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { getListTestCaseResults } from '../../../axiosAPIs/testAPI';
import { API_RES_MAX_SIZE } from '../../../constants/constants';
import {
  COLORS,
  PROFILER_FILTER_RANGE,
} from '../../../constants/profiler.constant';
import { CSMode } from '../../../enums/codemirror.enum';
import {
  TestCaseResult,
  TestCaseStatus,
} from '../../../generated/tests/tableTest';
import { TestCaseParameterValue } from '../../../generated/tests/testCase';
import { showErrorToast } from '../../../utils/ToastUtils';
import RichTextEditorPreviewer from '../../common/rich-text-editor/RichTextEditorPreviewer';
import Loader from '../../Loader/Loader';
import SchemaEditor from '../../schema-editor/SchemaEditor';
import { TestSummaryProps } from '../profilerDashboard.interface';

type ChartDataType = {
  information: { label: string; color: string }[];
  data: { [key: string]: string }[];
};

const TestSummary: React.FC<TestSummaryProps> = ({ data }) => {
  const [chartData, setChartData] = useState<ChartDataType>(
    {} as ChartDataType
  );
  const [results, setResults] = useState<TestCaseResult[]>([]);
  const [selectedTimeRange, setSelectedTimeRange] =
    useState<keyof typeof PROFILER_FILTER_RANGE>('last3days');
  const [isLoading, setIsLoading] = useState(true);

  const timeRangeOption = useMemo(() => {
    return Object.entries(PROFILER_FILTER_RANGE).map(([key, value]) => ({
      label: value.title,
      value: key,
    }));
  }, []);

  const handleTimeRangeChange = (value: keyof typeof PROFILER_FILTER_RANGE) => {
    if (value !== selectedTimeRange) {
      setSelectedTimeRange(value);
    }
  };

  const generateChartData = (currentData: TestCaseResult[]) => {
    const chartData: { [key: string]: string }[] = [];
    currentData.forEach((result) => {
      const values = result.testResultValue?.reduce((acc, curr) => {
        return {
          ...acc,
          [curr.name || 'value']: parseInt(curr.value || '') || 0,
        };
      }, {});

      chartData.push({
        name: moment.unix(result.timestamp || 0).format('DD/MMM HH:mm'),
        status: result.testCaseStatus || '',
        ...values,
      });
    });
    setChartData({
      information:
        currentData[0]?.testResultValue?.map((info, i) => ({
          label: info.name || '',
          color: COLORS[i],
        })) || [],
      data: chartData.reverse(),
    });
  };

  const updatedDot: LineProps['dot'] = (props) => {
    const { cx = 0, cy = 0, payload } = props;
    const fill =
      payload.status === TestCaseStatus.Success
        ? '#28A745'
        : payload.status === TestCaseStatus.Failed
        ? '#CB2431'
        : '#EFAE2F';

    return (
      <svg
        fill="none"
        height={8}
        width={8}
        x={cx - 4}
        xmlns="http://www.w3.org/2000/svg"
        y={cy - 4}>
        <circle cx={4} cy={4} fill={fill} r={4} />
      </svg>
    );
  };

  const fetchTestResults = async () => {
    if (isEmpty(data)) return;

    try {
      const startTs = moment()
        .subtract(PROFILER_FILTER_RANGE[selectedTimeRange].days, 'days')
        .unix();
      const endTs = moment().unix();
      const { data: chartData } = await getListTestCaseResults(
        data.fullyQualifiedName || '',
        {
          startTs,
          endTs,
          limit: API_RES_MAX_SIZE,
        }
      );
      setResults(chartData);
      generateChartData(chartData);
    } catch (error) {
      showErrorToast(error as AxiosError);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTestResults();
  }, [selectedTimeRange]);

  const showParamsData = (param: TestCaseParameterValue) => {
    const isSqlQuery = param.name === 'sqlExpression';

    if (isSqlQuery) {
      return (
        <div key={param.name}>
          <Typography.Text>{param.name}: </Typography.Text>
          <SchemaEditor
            className="tw-w-11/12 tw-mt-1"
            editorClass="table-query-editor"
            mode={{ name: CSMode.SQL }}
            options={{
              styleActiveLine: false,
            }}
            value={param.value ?? ''}
          />
        </div>
      );
    }

    return (
      <div key={param.name}>
        <Typography.Text>{param.name}: </Typography.Text>
        <Typography.Text>{param.value}</Typography.Text>
      </div>
    );
  };

  const referenceArea = () => {
    const yValues = data.parameterValues?.reduce((acc, curr, i) => {
      return { ...acc, [`y${i + 1}`]: parseInt(curr.value || '') };
    }, {});

    return (
      <ReferenceArea
        fill="#28A74530"
        ifOverflow="extendDomain"
        stroke="#28A745"
        strokeDasharray="4"
        {...yValues}
      />
    );
  };

  return (
    <Row gutter={16}>
      <Col span={14}>
        {isLoading ? (
          <Loader />
        ) : results.length ? (
          <div>
            <Space align="end" className="tw-w-full" direction="vertical">
              <Select
                className="tw-w-32 tw-mb-2"
                options={timeRangeOption}
                value={selectedTimeRange}
                onChange={handleTimeRangeChange}
              />
            </Space>
            <ResponsiveContainer className="tw-bg-white" minHeight={300}>
              <LineChart
                data={chartData.data}
                margin={{
                  top: 8,
                  bottom: 8,
                  right: 8,
                }}>
                <XAxis dataKey="name" padding={{ left: 8, right: 8 }} />
                <YAxis allowDataOverflow padding={{ top: 8, bottom: 8 }} />
                <Tooltip />
                <Legend />
                {data.parameterValues?.length === 2 && referenceArea()}
                {chartData?.information?.map((info, i) => (
                  <Line
                    dataKey={info.label}
                    dot={updatedDot}
                    key={i}
                    stroke={info.color}
                    type="monotone"
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <Empty description="No Result Available" />
        )}
      </Col>
      <Col span={10}>
        <Row gutter={[8, 8]}>
          <Col span={24}>
            <Typography.Text type="secondary">Name: </Typography.Text>
            <Typography.Text>{data.displayName || data.name}</Typography.Text>
          </Col>
          <Col span={24}>
            <Typography.Text type="secondary">Parameter: </Typography.Text>
          </Col>
          <Col offset={1} span={24}>
            {data.parameterValues && data.parameterValues.length > 0 ? (
              data.parameterValues.map(showParamsData)
            ) : (
              <Typography.Text type="secondary">
                No Parameter Available
              </Typography.Text>
            )}
          </Col>

          <Col className="tw-flex tw-gap-2" span={24}>
            <Typography.Text type="secondary">Description: </Typography.Text>
            <RichTextEditorPreviewer markdown={data.description || ''} />
          </Col>
        </Row>
      </Col>
    </Row>
  );
};

export default TestSummary;