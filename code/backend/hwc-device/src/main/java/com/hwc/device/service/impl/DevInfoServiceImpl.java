package com.hwc.device.service.impl;

import com.baomidou.mybatisplus.core.conditions.query.LambdaQueryWrapper;
import com.baomidou.mybatisplus.extension.service.impl.ServiceImpl;
import com.hwc.common.exception.BizException;
import com.hwc.common.exception.CommonErrorCode;
import com.hwc.device.mapper.DevInfoMapper;
import com.hwc.device.mapper.DevModelMapper;
import com.hwc.device.service.DevInfoService;
import com.hwc.domain.device.DevInfo;
import com.hwc.domain.device.DevModel;
import org.springframework.stereotype.Service;

@Service
public class DevInfoServiceImpl extends ServiceImpl<DevInfoMapper, DevInfo> implements DevInfoService {

    private final DevModelMapper devModelMapper;

    public DevInfoServiceImpl(DevModelMapper devModelMapper) {
        this.devModelMapper = devModelMapper;
    }

    @Override
    public boolean existsByCode(String code, Long excludeId) {
        return count(new LambdaQueryWrapper<DevInfo>()
                .eq(DevInfo::getCode, code)
                .ne(excludeId != null, DevInfo::getId, excludeId)) > 0;
    }

    @Override
    public Long resolveTypeIdByModel(Long modelId) {
        DevModel model = devModelMapper.selectById(modelId);
        if (model == null) {
            throw new BizException(CommonErrorCode.PARAM_INVALID, "设备型号不存在");
        }
        return model.getTypeId();
    }
}